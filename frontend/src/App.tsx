import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Layout } from "@/components/layout";
import { InjectionPage } from "@/pages/injection.page";
import { QueriesPage } from "@/pages/queries.page";
import { BenchmarkPage } from "@/pages/benchmark.page";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<InjectionPage />} />
          <Route path="/queries" element={<QueriesPage />} />
          <Route path="/benchmark" element={<BenchmarkPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
