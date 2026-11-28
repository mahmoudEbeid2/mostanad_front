// Certificates → Numbering & types (UI plan, Phase D/F): the company's certificate types and, per type,
// how its certificates are numbered. Any user of the company can change the numbering (no admin needed).
import CertificateTypes from "./CertificateTypes";
import NumberingTable from "../components/certificates/NumberingTable";
import useCompanyScope from "../hooks/useCompanyScope";

export default function NumberingAndTypes() {
  const { scope, companyId } = useCompanyScope();
  return (
    <div className="space-y-8">
      <CertificateTypes />
      {scope && companyId && <NumberingTable scope={scope} companyId={companyId} />}
    </div>
  );
}
