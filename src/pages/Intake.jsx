import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import { FileText, FolderUp, Loader2, UploadCloud, X } from "lucide-react";
import { createIntake, uploadIntakeFile, classifyIntake, filesFromDrop, listIntakes } from "../services/apiIntake";
import { getCompanies } from "../services/apiCompanies";
import { useAuth } from "../context/AuthContext";
import { isCompanyUser } from "../utils/permissions";
import IntakeReview from "../components/intake/IntakeReview";
import { fmtDateTime, t } from "../i18n";

// "ارفع ملفاتك": drop any files — many, a folder, a .zip — with no company picked
// first. Each file is sent in chunks (with its own progress), then recognised; the
// review card (/intake/:batchId) files everything on "نفّذ الكل".

const ACCEPT = ".pdf,.ai,.png,.jpg,.jpeg,.webp,.xlsx,.csv,.html,.htm,.zip";
const OK = /\.(pdf|ai|png|jpe?g|webp|xlsx|csv|html?|zip)$/i;
const MB = (n) => `${(n / 1024 / 1024).toFixed(n < 1024 * 1024 ? 2 : 1)} MB`;

export default function Intake() {
  const { batchId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const isSystem = !(isCompanyUser(user) || user?.isCompany);
  const [picked, setPicked] = useState([]); // [{ key, file, relPath, progress, state, error }]
  const [companyId, setCompanyId] = useState("");
  const [companies, setCompanies] = useState([]);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [recent, setRecent] = useState([]);
  const fileRef = useRef(null);
  const folderRef = useRef(null);

  useEffect(() => {
    if (isSystem) getCompanies({ limit: 1000, sort: "name" }).then((r) => setCompanies(r?.data?.companies || [])).catch(() => {});
    listIntakes().then(setRecent).catch(() => {});
  }, [isSystem]);
  // files dropped on the dashboard come with the navigation
  useEffect(() => {
    const dropped = location.state?.files;
    if (dropped?.length) add(dropped.map((f) => (f.file ? f : { file: f, relPath: null })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const add = (list) => {
    const good = list.filter(({ file }) => OK.test(file.name));
    const bad = list.length - good.length;
    if (bad) toast.error(t("intake.filesHaveAnUnsupportedType", { bad }));
    setPicked((p) => [...p, ...good.map(({ file, relPath }) => ({ key: `${relPath || file.name}-${file.size}-${Math.random()}`, file, relPath, progress: 0, state: "waiting" }))]);
  };
  const patch = (key, change) => setPicked((p) => p.map((x) => (x.key === key ? { ...x, ...change } : x)));

  const start = async () => {
    setBusy(true);
    try {
      const { batch, chunkBytes } = await createIntake(isSystem ? companyId || null : null);
      // two at a time, each with its own progress; a failed file is said, the rest go on
      const queue = [...picked];
      const worker = async () => {
        for (let x = queue.shift(); x; x = queue.shift()) {
          patch(x.key, { state: "uploading" });
          try {
            await uploadIntakeFile(batch.id, x.file, { relPath: x.relPath, chunkBytes, onProgress: (progress) => patch(x.key, { progress }) });
            patch(x.key, { state: "done", progress: 1 });
          } catch (e) {
            patch(x.key, { state: "failed", error: e.message });
          }
        }
      };
      await Promise.all([worker(), worker()]);
      await classifyIntake(batch.id);
      navigate(`/intake/${batch.id}`);
      setPicked([]);
    } catch (e) {
      toast.error(e?.response?.data?.message || e.message);
    } finally {
      setBusy(false);
    }
  };

  if (batchId)
    return (
      <div className="mx-auto max-w-7xl space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">{t("intake.yourFiles")}</h1>
          <button type="button" onClick={() => navigate("/intake")} className="text-sm text-blue-700 hover:underline">{t("intake.uploadMoreFiles")}</button>
        </div>
        <IntakeReview batchId={batchId} />
      </div>
    );

  const total = picked.reduce((n, x) => n + x.file.size, 0);
  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t("intake.uploadYourFiles")}</h1>
        <p className="mt-1 text-gray-500">{t("intake.dropAnyFilesLabelsCertificates")}</p>
      </div>
      <div
        className={`rounded-2xl border-2 border-dashed px-6 py-10 text-center ${dragging ? "border-blue-500 bg-blue-50" : "border-gray-300 bg-white"}`}
        onDragOver={(e) => (e.preventDefault(), setDragging(true))}
        onDragLeave={() => setDragging(false)}
        onDrop={async (e) => {
          e.preventDefault();
          setDragging(false);
          add(await filesFromDrop(e.dataTransfer));
        }}
        data-testid="intake-dropzone"
      >
        <UploadCloud className="mx-auto h-10 w-10 text-blue-500" />
        <p className="mt-2 font-semibold text-gray-800">{t("intake.dragFilesOrAWhole")}</p>
        <p className="text-sm text-gray-500">{t("intake.pdfAiImagesExcelCsv")}</p>
        <div className="mt-3 flex justify-center gap-2">
          <button type="button" onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
            <FileText className="h-4 w-4" />{" "}{t("intake.chooseFiles")}</button>
          <button type="button" onClick={() => folderRef.current?.click()} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
            <FolderUp className="h-4 w-4" />{" "}{t("intake.chooseAFolder")}</button>
        </div>
        <input ref={fileRef} type="file" multiple accept={ACCEPT} className="hidden" data-testid="intake-files" onChange={(e) => (add([...(e.target.files || [])].map((file) => ({ file, relPath: null }))), (e.target.value = ""))} />
        <input ref={folderRef} type="file" multiple webkitdirectory="" directory="" className="hidden" onChange={(e) => (add([...(e.target.files || [])].map((file) => ({ file, relPath: file.webkitRelativePath || null }))), (e.target.value = ""))} />
      </div>

      {picked.length > 0 && (
        <div className="space-y-3 rounded-2xl border border-gray-200 bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-gray-700">
              {picked.length}{" "}{t("intake.files", { MB: MB(total) })}</p>
            {isSystem && (
              <label className="flex items-center gap-2 text-sm text-gray-700">{t("intake.theseFilesBelongTo")}<select value={companyId} onChange={(e) => setCompanyId(e.target.value)} disabled={busy} className="rounded-lg border border-gray-300 bg-white px-2 py-1 text-sm" aria-label={t("intake.companyOptional")}>
                  <option value="">{t("intake.letTheSystemWorkIt")}</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
          <ul className="max-h-80 divide-y divide-gray-100 overflow-y-auto" data-testid="intake-picked">
            {picked.map((x) => (
              <li key={x.key} className="flex items-center gap-3 py-2 text-sm" data-state={x.state}>
                <FileText className="h-4 w-4 shrink-0 text-gray-400" />
                <span className="min-w-0 flex-1 truncate" dir="ltr" title={x.relPath || x.file.name}>
                  {x.relPath || x.file.name}
                </span>
                <span className="w-16 text-xs text-gray-500" dir="ltr">
                  {MB(x.file.size)}
                </span>
                <div className="h-1.5 w-28 rounded-full bg-gray-100" role="progressbar" aria-valuenow={Math.round(x.progress * 100)} aria-valuemin={0} aria-valuemax={100} aria-label={x.file.name}>
                  <div className={`h-1.5 rounded-full ${x.state === "failed" ? "bg-red-500" : "bg-blue-600"}`} style={{ width: `${Math.round(x.progress * 100)}%` }} />
                </div>
                {x.state === "failed" ? <span className="text-xs text-red-700">{x.error}</span> : null}
                {!busy && (
                  <button type="button" onClick={() => setPicked((p) => p.filter((y) => y.key !== x.key))} aria-label={t("intake.remove", { name: x.file.name })} className="text-gray-400 hover:text-gray-700">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </li>
            ))}
          </ul>
          <div className="flex justify-end">
            <button type="button" onClick={start} disabled={busy} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2 text-sm font-bold text-white shadow hover:bg-blue-700 disabled:opacity-50" data-testid="intake-start">
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}{" "}{t("intake.uploadAndRecogniseTheFiles")}</button>
          </div>
        </div>
      )}

      {recent.length > 0 && !picked.length && (
        <div className="rounded-2xl border border-gray-200 bg-white p-4">
          <h2 className="mb-2 text-sm font-semibold text-gray-800">{t("intake.recentUploads")}</h2>
          <ul className="divide-y divide-gray-100 text-sm">
            {recent.slice(0, 8).map((b) => (
              <li key={b.id} className="flex items-center justify-between py-2">
                <button type="button" onClick={() => navigate(`/intake/${b.id}`)} className="text-blue-700 hover:underline">
                  {b.files}{" "}{t("intake.files2")}{" "}{fmtDateTime(b.createdAt)}
                </button>
                <span className="text-xs text-gray-500">{{ review: t("intake.waitingForYourOk"), done: t("intake.done"), executing: t("intake.filing"), classifying: t("intake.recognising"), uploading: t("intake.uploading") }[b.status] || b.status}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
