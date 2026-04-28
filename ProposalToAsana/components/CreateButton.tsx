"use client";

type CreateButtonProps = {
  disabled: boolean;
  creating: boolean;
  onClick: () => void;
};

export function CreateButton({ disabled, creating, onClick }: CreateButtonProps) {
  return (
    <button type="button" className="primary-button" disabled={disabled || creating} onClick={onClick}>
      {creating ? "Asana 생성 중..." : "생성하기"}
    </button>
  );
}
