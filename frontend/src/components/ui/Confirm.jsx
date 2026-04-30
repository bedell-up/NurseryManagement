import Modal from './Modal';

export default function Confirm({ title, message, onConfirm, onCancel, danger = true }) {
  return (
    <Modal title={title} onClose={onCancel} size="sm">
      <p className="text-forest-700 mb-6">{message}</p>
      <div className="flex justify-end gap-3">
        <button onClick={onCancel} className="btn-secondary">Cancel</button>
        <button onClick={onConfirm} className={danger ? 'btn-danger' : 'btn-primary'}>Confirm</button>
      </div>
    </Modal>
  );
}
