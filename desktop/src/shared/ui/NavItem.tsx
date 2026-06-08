import { NavLink } from "react-router-dom";

function NavItem({
  to,
  icon,
  children,
}: {
  readonly to: string;
  readonly icon: React.ReactNode;
  readonly children: React.ReactNode;
}) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `
        flex items-center gap-2.5
        rounded-xl
        px-3 py-2.5
        text-sm
        font-medium
        transition-all
        duration-150
        ease-out
        focus-visible:outline-none
        focus-visible:ring-2
        focus-visible:ring-primary/20
        focus-visible:ring-offset-2
        focus-visible:ring-offset-surface-primary
        ${
          isActive
            ? "bg-primary/10 text-text-primary"
            : "text-text-secondary hover:bg-surface-secondary hover:text-text-primary"
        }
        `
      }
    >
      {icon}
      {children}
    </NavLink>
  );
}

export default NavItem;
