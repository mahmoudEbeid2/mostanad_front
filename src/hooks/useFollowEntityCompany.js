// Phase 6 (28 Nov): a deep link (the request page's «افتح», a chat card, an email) opens its certificate /
// template / request whatever company this browser had selected — the page reads the item's company and
// switches to it, with a short notice. A company session never switches (it only sees its own).
import { useEffect, useRef } from "react";
import toast from "react-hot-toast";
import apiClient from "../services/apiClient";

export default function useFollowEntityCompany(scopeState, type, id) {
  const asked = useRef(null);
  useEffect(() => {
    if (!scopeState || scopeState.isCompany || !id || asked.current === `${type}:${id}`) return;
    asked.current = `${type}:${id}`;
    apiClient
      .get(`/entity-company/${type}/${id}`)
      .then((r) => {
        const { companyId, companyName } = r.data.data;
        if (companyId && companyId !== scopeState.companyId) {
          scopeState.setCompanyId(companyId);
          toast(`اتنقلت لشركة ${companyName}`, { icon: "↪" });
        }
      })
      .catch(() => {});
  }, [scopeState, type, id]);
}
