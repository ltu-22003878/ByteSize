import { Routes, Route } from "react-router-dom";
import Header from "./Header";
import Toast from "./Toast";
import Home from "./Home";
import Learn from "./Learn";
import Earn from "./Earn";
import Messages from "./Messages";
import Profile from "./Profile";
import About from "./About";

export default function App() {
  return (
    <div className="site">
      <Header />
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/learn" element={<Learn />} />
          <Route path="/earn" element={<Earn />} />
          <Route path="/messages" element={<Messages />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/about" element={<About />} />
          <Route path="*" element={<Home />} />
        </Routes>
      </main>
      <Toast />
    </div>
  );
}
