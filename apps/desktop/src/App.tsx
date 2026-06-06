import { Outlet } from "react-router-dom";
import { AuthProvider } from "./app/providers/AuthProvider";

function App() {
  return (
    <AuthProvider>
      <Outlet />
    </AuthProvider>
  );
}

export default App;
