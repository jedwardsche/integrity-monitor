"""Duplicate detection logic based on docs/prompt-3-duplicate-spec.md."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime
from itertools import combinations
import uuid
from typing import Any, Callable, Dict, Iterable, List, Optional, Set, Tuple

from ..config.models import DuplicateDefinition, DuplicateRule, SchemaConfig
from ..utils.issues import IssuePayload
from ..utils.normalization import normalize_name, normalize_phone
from ..utils.similarity import jaccard_ratio, jaro_winkler
from .duplicate_conditions import evaluate_condition

LIKELY_THRESHOLD = 0.8
POSSIBLE_THRESHOLD = 0.6
LIKELY_SEVERITY = "warning"
POSSIBLE_SEVERITY = "info"


@dataclass
class StudentRecord:
    record_id: str
    name: str
    normalized_name: str
    last_name_norm: str
    last_name_soundex: str
    campus: str
    grade: str
    parents: Set[str]
    truth_id: str
    dob: Optional[date]
    email: str
    email_local: str
    email_domain: str
    phone: str
    normalized_phone: str


@dataclass
class ParentRecord:
    record_id: str
    name: str
    normalized_name: str
    last_name_soundex: str
    students: Set[str]
    email: str
    normalized_email: str
    phone: str
    normalized_phone: str
    address_zip: str


@dataclass
class ContractorRecord:
    record_id: str
    name: str
    normalized_name: str
    name_soundex: str
    email: str
    normalized_email: str
    phone: str
    normalized_phone: str
    campuses: Set[str]
    ein: str


@dataclass
class PairMatch:
    entity: str
    primary_id: str
    secondary_id: str
    rule_id: str
    match_type: str
    severity: str
    confidence: float
    evidence: Dict[str, Any]


def run(records: Dict[str, list], schema_config: Optional[SchemaConfig] = None) -> List[IssuePayload]:
    """Run duplicate detection checks.
    
    Args:
        records: Dictionary mapping entity names to lists of raw records
        schema_config: Optional SchemaConfig with duplicate rules. If None, uses hardcoded logic.
    """
    issues: List[IssuePayload] = []
    
    dup_config = schema_config.duplicates if schema_config else {}
    
    issues.extend(_process_students(records.get("students", []), dup_config.get("students")))
    issues.extend(_process_parents(records.get("parents", []), dup_config.get("parents")))
    issues.extend(_process_contractors(records.get("contractors", []), dup_config.get("contractors")))
    return issues


# ---------------------------------------------------------------------------
# Normalization helpers
# ---------------------------------------------------------------------------


def _extract_field(fields: Dict[str, Any], *keys: str) -> Any:
    for key in keys:
        if key in fields:
            return fields[key]
        title_key = key.replace("_", " ").title()
        if title_key in fields:
            return fields[title_key]
    return None


def _parse_dob(value: Any) -> Optional[date]:
    if not value:
        return None
    if isinstance(value, date):
        return value
    if isinstance(value, datetime):
        return value.date()
    for fmt in ("%Y-%m-%d", "%m/%d/%Y"):
        try:
            return datetime.strptime(str(value), fmt).date()
        except ValueError:
            continue
    return None


def _soundex(value: str) -> str:
    """Standard Soundex algorithm for phonetic matching.

    Rules:
    1. Keep first letter
    2. Remove H, W (they don't separate same sounds)
    3. Encode remaining letters: BFPV→1, CGJKQSXZ→2, DT→3, L→4, MN→5, R→6
    4. Remove consecutive duplicates
    5. Remove vowels (A, E, I, O, U) and Y
    6. Pad with zeros to length 4
    """
    value = (value or "").upper()
    if not value or not value[0].isalpha():
        return "0000"

    # Soundex code mapping
    codes = {
        "B": "1", "F": "1", "P": "1", "V": "1",
        "C": "2", "G": "2", "J": "2", "K": "2", "Q": "2", "S": "2", "X": "2", "Z": "2",
        "D": "3", "T": "3",
        "L": "4",
        "M": "5", "N": "5",
        "R": "6",
    }

    # Keep first letter
    result = value[0]
    prev_code = codes.get(value[0], "")

    # Process remaining characters
    for char in value[1:]:
        # Skip H, W, vowels (A, E, I, O, U, Y) - they don't encode
        if char in "AEIOUHWY":
            prev_code = ""  # Reset to allow same sound after vowel
            continue

        code = codes.get(char, "")
        if code and code != prev_code:
            result += code
            if len(result) == 4:
                break
        prev_code = code

    # Pad with zeros to length 4
    return (result + "000")[:4]


def _normalize_email(email: Any) -> Tuple[str, str, str]:
    if not email or not isinstance(email, str):
        return "", "", ""
    value = email.strip().lower()
    local, _, domain = value.partition("@")
    if "+" in local:
        local = local.split("+", 1)[0]
    local_alias = local.replace(".", "")
    return value, local_alias, domain


def _ensure_list(value: Any) -> List[str]:
    if isinstance(value, list):
        return [str(v) for v in value if v]
    if isinstance(value, str):
        return [value]
    return []


def _normalize_students(records: Iterable[dict]) -> Dict[str, StudentRecord]:
    normalized: Dict[str, StudentRecord] = {}
    for record in records:
        record_id = record.get("id")
        fields = record.get("fields", {})
        if not record_id:
            continue
        first = _extract_field(fields, "legal_first_name", "first_name")
        middle = _extract_field(fields, "legal_middle_name", "middle_name")
        last = _extract_field(fields, "legal_last_name", "last_name", "last")
        preferred = _extract_field(fields, "preferred_name", "nickname")
        fallback_name = _extract_field(fields, "name", "full_name")
        full_name = " ".join(filter(None, [first, middle, last])) or (preferred or fallback_name or "")
        normalized_name = normalize_name(full_name)
        last_name_norm = normalize_name(last or (full_name.split()[-1] if full_name else ""))
        campus = str(_extract_field(fields, "primary_campus", "campus") or "").strip().lower()
        grade = str(_extract_field(fields, "grade_level", "grade") or "").strip().lower()
        parents = set(_ensure_list(_extract_field(fields, "parents", "parent_links", "linked_parents")))
        truth_id = str(_extract_field(fields, "truth_id") or "").strip()
        dob = _parse_dob(_extract_field(fields, "date_of_birth", "dob", "birth_date"))
        email, email_local, email_domain = _normalize_email(_extract_field(fields, "primary_email", "email"))
        phone = str(_extract_field(fields, "primary_phone", "phone") or "")
        normalized[record_id] = StudentRecord(
            record_id=record_id,
            name=full_name.strip(),
            normalized_name=normalized_name,
            last_name_norm=last_name_norm,
            last_name_soundex=_soundex(last_name_norm),
            campus=campus,
            grade=grade,
            parents=parents,
            truth_id=truth_id,
            dob=dob,
            email=email,
            email_local=email_local,
            email_domain=email_domain,
            phone=phone,
            normalized_phone=normalize_phone(phone),
        )
    return normalized


def _normalize_parents(records: Iterable[dict]) -> Dict[str, ParentRecord]:
    normalized: Dict[str, ParentRecord] = {}
    for record in records:
        record_id = record.get("id")
        fields = record.get("fields", {})
        if not record_id:
            continue
        full_name = str(_extract_field(fields, "full_name", "name") or "").strip()
        normalized_name = normalize_name(full_name)
        email, _, _ = _normalize_email(_extract_field(fields, "contact_email", "email", "primary_email"))
        phone = str(_extract_field(fields, "contact_phone", "phone", "primary_phone") or "")
        students = set(_ensure_list(_extract_field(fields, "students", "linked_students")))
        address = str(_extract_field(fields, "mailing_zip", "zip_code", "postal_code") or "")
        normalized[record_id] = ParentRecord(
            record_id=record_id,
            name=full_name,
            normalized_name=normalized_name,
            last_name_soundex=_soundex(normalize_name(full_name).split(" ")[-1] if full_name else ""),
            students=students,
            email=email,
            normalized_email=email,
            phone=phone,
            normalized_phone=normalize_phone(phone),
            address_zip=address.strip(),
        )
    return normalized


def _normalize_contractors(records: Iterable[dict]) -> Dict[str, ContractorRecord]:
    normalized: Dict[str, ContractorRecord] = {}
    for record in records:
        record_id = record.get("id")
        fields = record.get("fields", {})
        if not record_id:
            continue
        legal_name = str(_extract_field(fields, "legal_name") or "").strip()
        normalized_name = normalize_name(legal_name)
        email, _, _ = _normalize_email(_extract_field(fields, "email"))
        phone = str(_extract_field(fields, "phone") or "")
        campuses = set(_ensure_list(_extract_field(fields, "campuses", "campus_assignments")))
        ein = str(_extract_field(fields, "ein", "vendor_id") or "").strip()
        normalized[record_id] = ContractorRecord(
            record_id=record_id,
            name=legal_name,
            normalized_name=normalized_name,
            name_soundex=_soundex(normalized_name),
            email=email,
            normalized_email=email,
            phone=phone,
            normalized_phone=normalize_phone(phone),
            campuses=campuses,
            ein=ein,
        )
    return normalized


# ---------------------------------------------------------------------------
# Duplicate detection per entity
# ---------------------------------------------------------------------------


def _process_students(raw_records: List[dict], dup_def: Optional[DuplicateDefinition] = None) -> List[IssuePayload]:
    normalized = _normalize_students(raw_records)
    classifier = lambda a, b: _classify_pair(a, b, "student", dup_def) if dup_def else _classify_student_pair(a, b)
    pairs = _detect_pairs(normalized, classifier)
    return _build_group_issues("student", normalized, pairs)


def _process_parents(raw_records: List[dict], dup_def: Optional[DuplicateDefinition] = None) -> List[IssuePayload]:
    normalized = _normalize_parents(raw_records)
    classifier = lambda a, b: _classify_pair(a, b, "parent", dup_def) if dup_def else _classify_parent_pair(a, b)
    pairs = _detect_pairs(normalized, classifier)
    return _build_group_issues("parent", normalized, pairs)


def _process_contractors(raw_records: List[dict], dup_def: Optional[DuplicateDefinition] = None) -> List[IssuePayload]:
    normalized = _normalize_contractors(raw_records)
    classifier = lambda a, b: _classify_pair(a, b, "contractor", dup_def) if dup_def else _classify_contractor_pair(a, b)
    pairs = _detect_pairs(normalized, classifier)
    return _build_group_issues("contractor", normalized, pairs)


def _detect_pairs(
    normalized: Dict[str, Any],
    classifier: Callable[[Any, Any], Optional[PairMatch]],
) -> List[PairMatch]:
    buckets = _build_blocks(normalized)
    seen_pairs: Set[Tuple[str, str]] = set()
    matches: List[PairMatch] = []

    for bucket in buckets.values():
        if len(bucket) < 2:
            continue
        for a_id, b_id in combinations(bucket, 2):
            pair_key = tuple(sorted((a_id, b_id)))
            if pair_key in seen_pairs:
                continue
            seen_pairs.add(pair_key)
            record_a = normalized[a_id]
            record_b = normalized[b_id]
            match = classifier(record_a, record_b)
            if match:
                matches.append(match)
    return matches


def _build_blocks(normalized: Dict[str, Any]) -> Dict[str, List[str]]:
    buckets: Dict[str, List[str]] = {}
    for record_id, record in normalized.items():
        block_keys = _compute_blocks(record)
        for key in block_keys:
            if not key:
                continue
            buckets.setdefault(key, []).append(record_id)
    return buckets


def _compute_blocks(record: Any) -> List[str]:
    keys = []
    if isinstance(record, StudentRecord):
        if record.last_name_soundex and record.dob:
            keys.append(f"s:{record.last_name_soundex}:{record.dob}")
        if record.email_local and record.campus:
            keys.append(f"s:{record.email_local}:{record.campus}")
        if record.normalized_phone:
            keys.append(f"s:phone:{record.normalized_phone}")
        if record.truth_id:
            keys.append(f"s:truth:{record.truth_id}")
    elif isinstance(record, ParentRecord):
        if record.normalized_email:
            keys.append(f"p:email:{record.normalized_email}")
        if record.normalized_phone:
            keys.append(f"p:phone:{record.normalized_phone}")
        if record.last_name_soundex and record.address_zip:
            keys.append(f"p:{record.last_name_soundex}:{record.address_zip}")
    elif isinstance(record, ContractorRecord):
        if record.normalized_email:
            keys.append(f"c:email:{record.normalized_email}")
        if record.ein:
            keys.append(f"c:ein:{record.ein}")
        if record.name_soundex and record.campuses:
            for campus in record.campuses:
                keys.append(f"c:{record.name_soundex}:{campus}")
    return keys


# ---------------------------------------------------------------------------
# Rule-based classification logic
# ---------------------------------------------------------------------------


def _evaluate_rule(
    rule: DuplicateRule,
    record_a: Any,
    record_b: Any,
    entity: str,
    match_type: str,
) -> Optional[PairMatch]:
    """Evaluate a duplicate rule against two records.
    
    Args:
        rule: DuplicateRule to evaluate
        record_a: First normalized record
        record_b: Second normalized record
        entity: Entity type ("student", "parent", "contractor")
        match_type: "likely" or "possible"
        
    Returns:
        PairMatch if all conditions match, None otherwise
    """
    all_evidence: Dict[str, Any] = {}
    all_conditions_match = True
    
    for condition in rule.conditions:
        matches, evidence = evaluate_condition(condition, record_a, record_b, entity)
        all_evidence.update(evidence)
        
        if not matches:
            all_conditions_match = False
            break
    
    if not all_conditions_match:
        return None
    
    # Calculate confidence based on match type and evidence
    confidence = 0.95 if match_type == "likely" else 0.7
    
    # Adjust confidence based on evidence quality
    if "similarity" in str(all_evidence):
        for key, value in all_evidence.items():
            if isinstance(value, dict) and "similarity" in value:
                confidence = max(confidence, value.get("similarity", 0.7))
    
    return PairMatch(
        entity=entity,
        primary_id=record_a.record_id,
        secondary_id=record_b.record_id,
        rule_id=rule.rule_id,
        match_type=match_type,
        severity=rule.severity or (LIKELY_SEVERITY if match_type == "likely" else POSSIBLE_SEVERITY),
        confidence=round(confidence, 3),
        evidence=all_evidence,
    )


def _classify_pair(
    record_a: Any,
    record_b: Any,
    entity: str,
    dup_def: DuplicateDefinition,
) -> Optional[PairMatch]:
    """Generic rule-based classifier for duplicate pairs.
    
    Args:
        record_a: First normalized record
        record_b: Second normalized record
        entity: Entity type ("student", "parent", "contractor")
        dup_def: DuplicateDefinition with likely/possible rules
        
    Returns:
        PairMatch if any rule matches, None otherwise
    """
    # Try likely rules first
    for rule in dup_def.likely:
        match = _evaluate_rule(rule, record_a, record_b, entity, "likely")
        if match:
            return match
    
    # Then try possible rules
    for rule in dup_def.possible:
        match = _evaluate_rule(rule, record_a, record_b, entity, "possible")
        if match:
            return match
    
    return None


# ---------------------------------------------------------------------------
# Legacy hardcoded classification logic (fallback)
# ---------------------------------------------------------------------------


def _classify_student_pair(a: StudentRecord, b: StudentRecord) -> Optional[PairMatch]:
    evidence: Dict[str, Any] = {}
    if a.truth_id and a.truth_id == b.truth_id:
        evidence["truth_id"] = True
        return PairMatch(
            entity="student",
            primary_id=a.record_id,
            secondary_id=b.record_id,
            rule_id="dup.student.truth_id",
            match_type="likely",
            severity=LIKELY_SEVERITY,
            confidence=0.95,
            evidence=evidence,
        )

    email_match = bool(a.email and a.email == b.email)
    evidence["email_match"] = email_match
    phone_match = bool(a.normalized_phone and a.normalized_phone == b.normalized_phone)
    evidence["phone_match"] = phone_match
    name_similarity = jaro_winkler(a.normalized_name, b.normalized_name)
    evidence["name_similarity"] = round(name_similarity, 3)

    dob_match = bool(a.dob and b.dob and abs((a.dob - b.dob).days) <= 1)
    evidence["dob_match"] = dob_match
    parent_overlap = jaccard_ratio(a.parents, b.parents)
    evidence["parent_overlap"] = round(parent_overlap, 3)
    campus_match = bool(a.campus and a.campus == b.campus)
    evidence["campus_match"] = campus_match

    email_local_match = bool(
        a.email_local and a.email_local == b.email_local and a.email_domain != b.email_domain
    )
    evidence["email_local_alias"] = email_local_match

    score = 0.0
    if email_match:
        score += 0.6
    if phone_match:
        score += 0.3
    score += min(name_similarity, 1.0) * 0.2
    if dob_match:
        score += 0.1
    if parent_overlap >= 0.5:
        score += 0.1
    if campus_match and parent_overlap >= 0.3:
        score += 0.05
    if email_local_match:
        score += 0.1
    score = min(score, 1.0)

    if score >= LIKELY_THRESHOLD:
        rule_id = (
            "dup.student.email_dob"
            if email_match and dob_match
            else "dup.student.phone_name"
            if phone_match
            else "dup.student.parents_campus"
        )
        return PairMatch(
            entity="student",
            primary_id=a.record_id,
            secondary_id=b.record_id,
            rule_id=rule_id,
            match_type="likely",
            severity=LIKELY_SEVERITY,
            confidence=round(score, 3),
            evidence=evidence,
        )
    if score >= POSSIBLE_THRESHOLD:
        return PairMatch(
            entity="student",
            primary_id=a.record_id,
            secondary_id=b.record_id,
            rule_id="dup.student.name_campus",
            match_type="possible",
            severity=POSSIBLE_SEVERITY,
            confidence=round(score, 3),
            evidence=evidence,
        )
    if parent_overlap >= 0.4 and campus_match and name_similarity >= 0.88:
        return PairMatch(
            entity="student",
            primary_id=a.record_id,
            secondary_id=b.record_id,
            rule_id="dup.student.parent_overlap",
            match_type="possible",
            severity=POSSIBLE_SEVERITY,
            confidence=0.62,
            evidence=evidence,
        )
    return None


def _classify_parent_pair(a: ParentRecord, b: ParentRecord) -> Optional[PairMatch]:
    evidence: Dict[str, Any] = {}
    if a.normalized_email and a.normalized_email == b.normalized_email:
        evidence["email_match"] = True
        return PairMatch(
            entity="parent",
            primary_id=a.record_id,
            secondary_id=b.record_id,
            rule_id="dup.parent.email",
            match_type="likely",
            severity=LIKELY_SEVERITY,
            confidence=0.95,
            evidence=evidence,
        )
    if a.normalized_phone and a.normalized_phone == b.normalized_phone:
        evidence["phone_match"] = True
        return PairMatch(
            entity="parent",
            primary_id=a.record_id,
            secondary_id=b.record_id,
            rule_id="dup.parent.phone",
            match_type="likely",
            severity=LIKELY_SEVERITY,
            confidence=0.9,
            evidence=evidence,
        )

    name_similarity = jaro_winkler(a.normalized_name, b.normalized_name)
    evidence["name_similarity"] = round(name_similarity, 3)
    student_overlap = jaccard_ratio(a.students, b.students)
    evidence["student_overlap"] = round(student_overlap, 3)

    if name_similarity >= 0.92 and student_overlap >= 0.5:
        return PairMatch(
            entity="parent",
            primary_id=a.record_id,
            secondary_id=b.record_id,
            rule_id="dup.parent.name_student",
            match_type="possible",
            severity=POSSIBLE_SEVERITY,
            confidence=0.7,
            evidence=evidence,
        )
    if a.address_zip and a.address_zip == b.address_zip and name_similarity >= 0.9:
        return PairMatch(
            entity="parent",
            primary_id=a.record_id,
            secondary_id=b.record_id,
            rule_id="dup.parent.address",
            match_type="possible",
            severity=POSSIBLE_SEVERITY,
            confidence=0.65,
            evidence=evidence,
        )
    return None


def _classify_contractor_pair(a: ContractorRecord, b: ContractorRecord) -> Optional[PairMatch]:
    evidence: Dict[str, Any] = {}
    if a.ein and a.ein == b.ein:
        evidence["ein_match"] = True
        return PairMatch(
            entity="contractor",
            primary_id=a.record_id,
            secondary_id=b.record_id,
            rule_id="dup.contractor.ein",
            match_type="likely",
            severity=LIKELY_SEVERITY,
            confidence=0.95,
            evidence=evidence,
        )
    if a.normalized_email and a.normalized_email == b.normalized_email:
        evidence["email_match"] = True
        return PairMatch(
            entity="contractor",
            primary_id=a.record_id,
            secondary_id=b.record_id,
            rule_id="dup.contractor.email_phone",
            match_type="likely",
            severity=LIKELY_SEVERITY,
            confidence=0.9,
            evidence=evidence,
        )

    phone_match = bool(a.normalized_phone and a.normalized_phone == b.normalized_phone)
    evidence["phone_match"] = phone_match
    name_similarity = jaro_winkler(a.normalized_name, b.normalized_name)
    evidence["name_similarity"] = round(name_similarity, 3)
    campus_overlap = jaccard_ratio(a.campuses, b.campuses)
    evidence["campus_overlap"] = round(campus_overlap, 3)

    if phone_match and name_similarity >= 0.9:
        return PairMatch(
            entity="contractor",
            primary_id=a.record_id,
            secondary_id=b.record_id,
            rule_id="dup.contractor.email_phone",
            match_type="likely",
            severity=LIKELY_SEVERITY,
            confidence=0.85,
            evidence=evidence,
        )
    if name_similarity >= 0.92 and campus_overlap >= 0.5:
        return PairMatch(
            entity="contractor",
            primary_id=a.record_id,
            secondary_id=b.record_id,
            rule_id="dup.contractor.campus_name",
            match_type="possible",
            severity=POSSIBLE_SEVERITY,
            confidence=0.68,
            evidence=evidence,
        )
    return None


# ---------------------------------------------------------------------------
# Grouping logic
# ---------------------------------------------------------------------------


def _build_group_issues(
    entity: str,
    normalized: Dict[str, Any],
    matches: List[PairMatch],
) -> List[IssuePayload]:
    if not matches:
        return []

    parent: Dict[str, str] = {}

    def find(x: str) -> str:
        parent.setdefault(x, x)
        if parent[x] != x:
            parent[x] = find(parent[x])
        return parent[x]

    def union(x: str, y: str) -> None:
        root_x = find(x)
        root_y = find(y)
        if root_x != root_y:
            parent[root_y] = root_x

    for match in matches:
        union(match.primary_id, match.secondary_id)

    groups: Dict[str, Set[str]] = {}
    for record_id in normalized:
        root = find(record_id)
        groups.setdefault(root, set()).add(record_id)

    issues: List[IssuePayload] = []
    severity_rank = {"info": 0, "warning": 1, "critical": 2}

    for root, members in groups.items():
        if len(members) < 2:
            continue
        member_ids = sorted(members)
        group_matches = [m for m in matches if m.primary_id in members and m.secondary_id in members]
        top_match = max(group_matches, key=lambda m: severity_rank.get(m.severity, 0))
        related = [m for m in member_ids]
        primary_id = _select_primary(entity, members, normalized)
        related.remove(primary_id)
        group_id = str(uuid.uuid5(uuid.NAMESPACE_URL, f"{entity}:{'|'.join(member_ids)}"))
        description = f"{entity.title()} duplicate group with {len(members)} records (primary {primary_id})."
        metadata = {
            "group_id": group_id,
            "members": member_ids,
            "match_types": [m.match_type for m in group_matches],
            "confidences": [m.confidence for m in group_matches],
            "evidence_samples": group_matches[0].evidence if group_matches else {},
        }
        issues.append(
            IssuePayload(
                rule_id=top_match.rule_id,
                issue_type="duplicate",
                entity=entity,
                record_id=primary_id,
                severity=top_match.severity,
                description=description,
                metadata=metadata,
                related_records=related,
            )
        )
    return issues


def _select_primary(entity: str, members: Set[str], normalized: Dict[str, Any]) -> str:
    def completeness(record: Any) -> int:
        if isinstance(record, StudentRecord):
            return sum(
                bool(value)
                for value in [
                    record.truth_id,
                    record.email,
                    record.phone,
                    record.parents,
                    record.campus,
                    record.grade,
                ]
            )
        if isinstance(record, ParentRecord):
            return sum(bool(value) for value in [record.email, record.phone, record.students])
        if isinstance(record, ContractorRecord):
            return sum(bool(value) for value in [record.email, record.phone, record.ein, record.campuses])
        return 0

    return max(members, key=lambda record_id: (completeness(normalized[record_id]), record_id))
