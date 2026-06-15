import { useState } from "react";
import { IconArrowLeft } from "./Icons";
import { Modal } from "./Modal";

interface BackBarProps {
  onBack: () => void | Promise<void>;
  label: string;
  exitGuard?: boolean;
}

export const BackBar = ({ onBack, label, exitGuard }: BackBarProps) => {
  const [open, setOpen] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [leaveError, setLeaveError] = useState<string | null>(null);

  const leave = async () => {
    setLeaveError(null);
    setIsLeaving(true);
    try {
      await onBack();
      setOpen(false);
    } catch {
      setLeaveError("Couldn't save your latest progress. Please try again.");
    } finally {
      setIsLeaving(false);
    }
  };

  return (
    <>
      <div className="row gap-8" style={{ marginBottom: 24 }}>
        <button
          type="button"
          className="btn btn-soft btn-sm"
          onClick={() => (exitGuard ? setOpen(true) : onBack())}
        >
          <IconArrowLeft size={12} /> {label}
        </button>
      </div>
      <Modal open={open} onClose={() => setOpen(false)} ariaLabel="Leave task">
        <h3 style={{ marginBottom: 8 }}>Leave this task?</h3>
        <p style={{ color: "var(--ink-3)", fontSize: 14, marginBottom: 20 }}>
          Your progress will be saved as <strong>In Progress</strong>. You can
          pick it back up from the dashboard.
        </p>
        {leaveError && <div className="field-error">{leaveError}</div>}
        <div className="modal-actions">
          <button
            className="btn btn-ghost"
            onClick={() => setOpen(false)}
            disabled={isLeaving}
          >
            Stay
          </button>
          <button
            className={`btn btn-primary ${isLeaving ? "btn-loading" : ""}`}
            onClick={() => void leave()}
            disabled={isLeaving}
            aria-busy={isLeaving}
          >
            {isLeaving ? (
              <>
                <span className="spinner" /> Saving...
              </>
            ) : (
              "Leave & save"
            )}
          </button>
        </div>
      </Modal>
    </>
  );
};
