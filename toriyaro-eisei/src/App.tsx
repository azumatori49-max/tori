import { useState } from "react";
import { useAuth } from "./hooks/useAuth";
import { useStores } from "./hooks/useStores";
import { LoginScreen } from "./components/login/LoginScreen";
import { StoreTopScreen } from "./components/store/StoreTopScreen";
import { UploadScreen } from "./components/store/UploadScreen";
import { AdminScreen } from "./components/admin/AdminScreen";
import type { ReportType, Screen } from "./types";

function App() {
  const { auth, loginStore, loginAdmin, logout } = useAuth();
  const { stores } = useStores();
  const [screen, setScreen] = useState<Screen>("login");
  const [uploadType, setUploadType] = useState<ReportType>("daily");

  // resolve current screen based on auth state
  const current: Screen = !auth.storeKey
    ? "login"
    : auth.isAdmin
      ? "admin"
      : screen === "upload"
        ? "upload"
        : "store-top";

  if (current === "login") {
    return (
      <LoginScreen
        onLoginStore={(k) => {
          loginStore(k);
          setScreen("store-top");
        }}
        onLoginAdmin={() => loginAdmin()}
      />
    );
  }

  if (current === "admin") {
    return (
      <AdminScreen
        onLogout={() => {
          logout();
          setScreen("login");
        }}
      />
    );
  }

  const storeKey = auth.storeKey as string;
  const storeName = stores[storeKey]?.name ?? "店舗";

  if (current === "upload") {
    return (
      <UploadScreen
        storeKey={storeKey}
        storeName={storeName}
        type={uploadType}
        onBack={() => setScreen("store-top")}
      />
    );
  }

  return (
    <StoreTopScreen
      storeKey={storeKey}
      storeName={storeName}
      onOpenUpload={(t) => {
        setUploadType(t);
        setScreen("upload");
      }}
      onLogout={() => {
        logout();
        setScreen("login");
      }}
    />
  );
}

export default App;
