import { NavLink } from "react-router-dom";

function NavItem({
  to,
  icon,
  children,
}: {
  readonly to: string;
  readonly icon: any;
  readonly children: React.ReactNode;
}) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `
        flex items-center gap-3
        rounded-xl
        px-3 py-2.5
        text-sm
        transition
        ${
          isActive
            ? "bg-gray-100 dark:bg-white/10 font-medium text-gray-900 dark:text-white"
            : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5"
        }
        `
      }
    >
      <>{icon}</>
      {children}
    </NavLink>
  );
}

export default NavItem;
