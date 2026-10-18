import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { getCompanies } from "../services/apiCompanies";
import { isCompanyUser } from "../utils/permissions";

// Company picker state for the Certificates V2 pages (plan §13.1): a company
// session is always scoped to itself; a system user picks a company and every
// call adds ?companyId=. The choice is remembered per browser (convenience only).
const STORAGE_KEY = "certificates.companyId";

const readStored = () => {
  try {
    return localStorage.getItem(STORAGE_KEY) || "";
  } catch {
    return "";
  }
};

export default function useCompanyScope() {
  const { user } = useAuth();
  const isCompany = isCompanyUser(user) || !!user?.isCompany;
  const [companies, setCompanies] = useState([]);
  const [companyId, setCompanyIdState] = useState(readStored);
  const [loading, setLoading] = useState(!isCompany);

  useEffect(() => {
    if (isCompany) return;
    let alive = true;
    getCompanies({ limit: 100 })
      .then((res) => {
        if (!alive) return;
        const list = res?.data?.companies || [];
        setCompanies(list);
        setCompanyIdState((current) => (current && list.some((c) => c.id === current) ? current : list[0]?.id || ""));
      })
      .catch(() => alive && setCompanies([]))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [isCompany]);

  const setCompanyId = (id) => {
    setCompanyIdState(id);
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {
      /* storage unavailable — the choice just isn't remembered */
    }
  };

  const scope = useMemo(() => (isCompany ? {} : companyId ? { companyId } : null), [isCompany, companyId]);

  // `scope` is null until a system user has a company selected — pages wait for it.
  return { isCompany, companies, companyId: isCompany ? user?.id : companyId, setCompanyId, scope, loading };
}
