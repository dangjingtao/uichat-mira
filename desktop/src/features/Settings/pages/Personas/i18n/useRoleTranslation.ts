import { useTranslation } from "react-i18next";

export function useRoleTranslation() {
  const { t } = useTranslation("roles");
  return t;
}
