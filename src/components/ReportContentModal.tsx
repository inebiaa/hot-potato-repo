import { useState } from "react";
import { useT } from "../hooks/useCopy";
import {
  REPORT_REASONS,
  submitContentReport,
  type ReportReason,
  type ReportTargetType,
} from "../lib/ugcSafety";
import { Button, Modal, formErrorClass, formHintClass, typeCallout, formSuccessClass } from "./ui";

export type ReportContentModalProps = {
  isOpen: boolean;
  onClose: () => void;
  targetType: ReportTargetType;
  targetId: string;
  targetUserId?: string | null;
  supportEmail?: string;
  privacyUrl?: string;
  termsUrl?: string;
  onSubmitted?: () => void;
};

export default function ReportContentModal({
  isOpen,
  onClose,
  targetType,
  targetId,
  targetUserId,
  supportEmail,
  privacyUrl,
  termsUrl,
  onSubmitted,
}: ReportContentModalProps) {
  const t = useT();
  const [reason, setReason] = useState<ReportReason>("spam");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const { error: submitError } = await submitContentReport({
      targetType,
      targetId,
      targetUserId,
      reason,
    });
    setLoading(false);
    if (submitError) {
      setError(submitError);
      return;
    }
    setSuccess(true);
    onSubmitted?.();
    window.setTimeout(() => {
      setSuccess(false);
      onClose();
    }, 1200);
  };

  const email = (supportEmail || "").trim();

  return (
    <Modal
      onClose={onClose}
      title={t("safety.report.title")}
      panelClassName="max-w-md sm:rounded-lg"
    >
      <form
        onSubmit={(e) => void handleSubmit(e)}
        className="space-y-4 p-4 sm:p-6"
      >
        {success ? (
          <p className={formSuccessClass}>{t("safety.report.submitted")}</p>
        ) : (
          <>
            <fieldset className="space-y-2">
              <legend className={`mb-1 block ${typeCallout} font-medium text-foreground`}>
                {t("safety.report.reasonLabel")}
              </legend>
              {REPORT_REASONS.map((opt) => (
                <label
                  key={opt.value}
                  className={`flex cursor-pointer items-center gap-2 ${typeCallout}`}
                >
                  <input
                    type="radio"
                    name="report-reason"
                    value={opt.value}
                    checked={reason === opt.value}
                    onChange={() => setReason(opt.value)}
                    className="text-foreground"
                  />
                  <span>{t(opt.labelKey)}</span>
                </label>
              ))}
            </fieldset>

            {error ? <p className={formErrorClass}>{error}</p> : null}

            {(email || privacyUrl || termsUrl) && (
              <p className={formHintClass}>
                {email ? (
                  <>
                    {t("safety.report.contactPrefix")}{" "}
                    <a
                      href={`mailto:${email}`}
                      className="underline underline-offset-2"
                    >
                      {email}
                    </a>
                  </>
                ) : null}
                {privacyUrl ? (
                  <>
                    {email ? " · " : null}
                    <a
                      href={privacyUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline underline-offset-2"
                    >
                      {t("safety.legal.privacy")}
                    </a>
                  </>
                ) : null}
                {termsUrl ? (
                  <>
                    {" · "}
                    <a
                      href={termsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline underline-offset-2"
                    >
                      {t("safety.legal.terms")}
                    </a>
                  </>
                ) : null}
              </p>
            )}

            <div className="flex gap-2 pt-1">
              <Button
                type="button"
                variant="secondary"
                className="flex-1"
                onClick={onClose}
              >
                {t("safety.report.cancel")}
              </Button>
              <Button type="submit" disabled={loading} className="flex-1">
                {loading
                  ? t("safety.report.submitting")
                  : t("safety.report.submit")}
              </Button>
            </div>
          </>
        )}
      </form>
    </Modal>
  );
}
