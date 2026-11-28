import { useEffect, useMemo, useSyncExternalStore } from "react";
import { useAuth } from "../context/AuthContext";
import { getCompanies } from "../services/apiCompanies";
import { isCompanyUser } from "../utils/permissions";

// The company the app works on (UI plan, Phase G: ONE company switcher, in the header). A company session is
// always scoped to itself; a system user picks a company once, in the header, and every page follows it
// (every call adds ?companyId=). The state is shared by every caller of this hook, and the choice is
// remembered per browser (convenience only).
const STORAGE_KEY = "certificates.companyId";

const readStored = () => {
  try {
    return localStorage.getItem(STORAGE_KEY) || "";
  } catch {
    return "";
  }
};

let store = { companies: [], companyId: readStored(), loading: true, fetched: false };
const listeners = new Set();
const emit = (patch) => {
  store = { ...store, ...patch };
  listeners.forEach((l) => l());
};
const subscribe = (l) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const snapshot = () => store;

let inflight = null;
function fetchCompanies() {
  if (store.fetched || inflight) return;
  inflight = getCompanies({ limit: 100 })
    .then((res) => {
      const list = res?.data?.companies || [];
      const current = store.companyId && list.some((c) => c.id === store.companyId) ? store.companyId : list[0]?.id || "";
      emit({ companies: list, companyId: current, loading: false, fetched: true });
    })
    .catch(() => emit({ companies: [], loading: false, fetched: true }))
    .finally(() => {
      inflight = null;
    });
}

export function setGlobalCompanyId(id) {
  emit({ companyId: id });
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    /* storage unavailable — the choice just isn't remembered */
  }
  window.dispatchEvent(new Event("experiment-mode-changed")); // the experiment banner follows the company in view
}

export default function useCompanyScope() {
  const { user } = useAuth();
  const isCompany = isCompanyUser(user) || !!user?.isCompany;
  const { companies, companyId, loading } = useSyncExternalStore(subscribe, snapshot);

  useEffect(() => {
    if (!isCompany && user) fetchCompanies();
  }, [isCompany, user]);

  const scope = useMemo(() => (isCompany ? {} : companyId ? { companyId } : null), [isCompany, companyId]);

  // a company session shows its own name read-only where system users get the picker
  const companyName = isCompany ? user?.company?.name || user?.name || "" : companies.find((c) => c.id === companyId)?.name || "";

  // `scope` is null until a system user has a company selected — pages wait for it.
  return { isCompany, companies, companyId: isCompany ? user?.id : companyId, companyName, setCompanyId: setGlobalCompanyId, scope, loading: isCompany ? false : loading };
}
