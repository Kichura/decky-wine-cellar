import { DialogButton, Focusable, ModalRoot, TextField, showModal } from "@decky/ui";
import { useState } from "react";

type TextPromptModalProps = {
  title: string;
  description?: string;
  initialValue?: string;
  confirmLabel: string;
  onSubmit: (value: string) => void;
  closeModal?: () => void;
};

function TextPromptModal({
  title,
  description,
  initialValue = "",
  confirmLabel,
  onSubmit,
  closeModal,
}: TextPromptModalProps) {
  const [value, setValue] = useState(initialValue);
  const trimmedValue = value.trim();

  return (
    <ModalRoot closeModal={closeModal}>
      <Focusable
        onCancelButton={closeModal}
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "12px",
          padding: "16px",
        }}
      >
        <div style={{ fontSize: "22px", fontWeight: 700 }}>{title}</div>
        {description != null && (
          <div style={{ lineHeight: 1.4 }}>{description}</div>
        )}
        <TextField
          value={value}
          focusOnMount
          onChange={(event) => setValue(event.currentTarget.value)}
        />
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: "8px",
          }}
        >
          <DialogButton onClick={closeModal}>Cancel</DialogButton>
          <DialogButton
            disabled={trimmedValue.length === 0}
            onClick={() => {
              if (trimmedValue.length === 0) {
                return;
              }

              onSubmit(trimmedValue);
              closeModal?.();
            }}
          >
            {confirmLabel}
          </DialogButton>
        </div>
      </Focusable>
    </ModalRoot>
  );
}

type ShowTextPromptModalOptions = Omit<TextPromptModalProps, "closeModal">;

export function showTextPromptModal(options: ShowTextPromptModalOptions) {
  let modalRef: { Close: () => void } | undefined;
  const handleClose = () => {
    modalRef?.Close();
  };

  modalRef = showModal(
    <TextPromptModal {...options} closeModal={handleClose} />,
    window,
    {
      strTitle: options.title,
    },
  );

  return modalRef;
}
