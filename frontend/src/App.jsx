import React from "react";
import { Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar.jsx";
import Footer from "./components/Footer.jsx";
import Landing from "./pages/Landing.jsx";
import Disputes from "./pages/Disputes.jsx";
import FileDispute from "./pages/FileDispute.jsx";
import DisputeDetail from "./pages/DisputeDetail.jsx";
import JurorDashboard from "./pages/JurorDashboard.jsx";
import ReputationProfile from "./pages/ReputationProfile.jsx";
import NotFound from "./pages/NotFound.jsx";

export default function App() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/disputes" element={<Disputes />} />
          <Route path="/disputes/:id" element={<DisputeDetail />} />
          <Route path="/file" element={<FileDispute />} />
          <Route path="/jurors" element={<JurorDashboard />} />
          <Route path="/reputation" element={<ReputationProfile />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}
