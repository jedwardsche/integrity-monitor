import React from 'react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  isDestructive = false,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-0">
      <div 
        className="fixed inset-0 bg-neutral-900/50 backdrop-blur-sm transition-opacity" 
        onClick={onCancel}
        aria-hidden="true"
      />
      
      <div className="relative bg-surface border border-border rounded-xl shadow-xl w-full max-w-md transform transition-all p-6">
        <h3 className="text-lg font-semibold text-text-primary mb-2">
          {title}
        </h3>
        
        <p className="text-text-secondary mb-6 leading-relaxed">
          {message}
        </p>
        
        <div className="flex justify-end space-x-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary bg-surface-hover/50 hover:bg-surface-hover rounded-lg transition-colors"
          >
            {cancelLabel}
          </button>
          
          <button
            onClick={onConfirm}
            className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors shadow-sm ${
              isDestructive 
                ? 'bg-error hover:bg-error-hover shadow-error/20' 
                : 'bg-primary hover:bg-primary-hover shadow-primary/20'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
