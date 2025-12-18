---
name: Refine duplicate detection name matching logic
overview: "Update duplicate detection to use stricter name matching rules: require exact match on both first and last names, OR exact match on one name part with >80% similarity on the other part. This prevents false positives like husband/wife pairs with same last name but different first names."
todos:
  - id: "1"
    content: Add first_name and last_name fields to StudentRecord, ParentRecord, and ContractorRecord dataclasses
    status: completed
  - id: "2"
    content: Update _normalize_students() to extract and store first_name and last_name separately
    status: completed
  - id: "3"
    content: Update _normalize_parents() to parse full_name into first_name and last_name
    status: completed
  - id: "4"
    content: Update _normalize_contractors() to parse legal_name into first_name and last_name
    status: completed
  - id: "5"
    content: Create _check_name_match() helper function with the new matching logic (exact + >80% similarity rules)
    status: completed
  - id: "6"
    content: Update _classify_student_pair() to use new name matching logic
    status: completed
  - id: "7"
    content: Update _classify_parent_pair() to use new name matching logic
    status: completed
  - id: "8"
    content: Update _classify_contractor_pair() to use new name matching logic
    status: completed
  - id: "9"
    content: Update ruleFormatter.ts to handle new rule IDs
    status: completed
---

# Refine Duplicate Detection Name Matching Logic

## Problem

Current duplicate detection marks records as duplicates when they share a last name but have different first names (e.g., husband/wife contractors). The logic needs to be more precise to avoid false positives.

## Solution

Implement stricter name matching that requires:

1. **Exact duplicate**: Both first AND last names match exactly
2. **Similarity-based**: One name part matches exactly AND the other part has >80% similarity
3. **Not duplicate**: Only one name part matches exactly but the other is <80% similar

## Implementation

### 1. Update Record Dataclasses

**File**: `backend/checks/duplicates.py`Add `first_name` and `last_name` fields to:

- `StudentRecord` (already has first/last extracted, need to store separately)
- `ParentRecord` (currently only has full_name, need to parse)
- `ContractorRecord` (currently only has legal_name, need to parse)

### 2. Update Normalization Functions

**File**: `backend/checks/duplicates.py`Modify `_normalize_students()`, `_normalize_parents()`, and `_normalize_contractors()` to:

- Extract and normalize first_name and last_name separately
- Store them in the record dataclasses
- Handle cases where names might be missing or in different formats

### 3. Create Name Matching Helper Function

**File**: `backend/checks/duplicates.py`Add `_check_name_match()` function that:

- Takes two records with first_name and last_name
- Returns tuple: (is_duplicate: bool, match_type: str, confidence: float)
- Logic:
- If first_name matches exactly AND last_name matches exactly → exact duplicate (confidence 1.0)
- If first_name matches exactly AND last_name similarity > 0.8 → similarity duplicate (confidence based on similarity)
- If last_name matches exactly AND first_name similarity > 0.8 → similarity duplicate
- If only one name matches exactly but other < 0.8 similar → NOT duplicate (return False)
- If neither name matches exactly → use existing full name similarity logic as fallback

### 4. Update Classification Functions

**File**: `backend/checks/duplicates.py`Modify `_classify_student_pair()`, `_classify_parent_pair()`, and `_classify_contractor_pair()` to:

- Use the new `_check_name_match()` function
- Keep email/phone exact matches as overrides (duplicate regardless of name)
- Update scoring logic to incorporate the new name matching results
- Ensure name similarity checks use the 80% threshold for the non-matching name part

### 5. Update Rule IDs

**File**: `backend/checks/duplicates.py`Add new rule IDs for clarity:

- `dup.{entity}.name_exact` - both first and last names match exactly
- `dup.{entity}.name_first_similar` - first name exact, last name similar
- `dup.{entity}.name_last_similar` - last name exact, first name similar

### 6. Update Rule Formatter

**File**: `frontend/src/utils/ruleFormatter.ts`Add mappings for the new rule IDs to display human-readable descriptions.

## Key Changes

1. **Name Parsing**: Extract first and last names separately for all entity types
2. **Matching Logic**: 

- Exact match on both → duplicate
- Exact match on one + >80% on other → duplicate  
- Exact match on one + <80% on other → NOT duplicate

3. **Email/Phone Override**: Exact email or phone matches still mark as duplicate regardless of name similarity
4. **Threshold**: Use 0.8 (80%) as the similarity threshold for the non-matching name part

## Testing Considerations

- Test husband/wife case: same last name, different first names → should NOT be duplicate
- Test same person with slight name variation → should be duplicate if >80% similar