import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { UploadCloud } from "lucide-react";
import { filesFromDrop } from "../../services/apiIntake";
import { t } from "../../i18n";

// The dashboard's drop zone: files or a folder dropped here open "ارفع ملفاتك" with them.
export default function IntakeDropTile() {
  const navigate = useNavigate();
  const [over, setOver] = useState(false);
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => navigate("/intake")}
      onKeyDown={(e) => e.key === "Enter" && navigate("/intake")}
      onDragOver={(e) => (e.preventDefault(), setOver(true))}
      onDragLeave={() => setOver(false)}
      onDrop={async (e) => {
        e.preventDefault();
        setOver(false);
        navigate("/intake", { state: { files: await filesFromDrop(e.dataTransfer) } });
      }}
      className={`flex cursor-pointer items-center gap-4 rounded-2xl border-2 border-dashed p-5 ${over ? "border-blue-500 bg-blue-50" : "border-blue-200 bg-white hover:bg-blue-50/50"}`}
      data-testid="intake-tile"
    >
      <UploadCloud className="h-9 w-9 shrink-0 text-blue-600" />
      <div>
        <p className="font-bold text-gray-900">{t("intakeDropTile.uploadYourFiles")}</p>
        <p className="text-sm text-gray-500">{t("intakeDropTile.dropAnyFilesOrA")}</p>
      </div>
    </div>
  );
}
