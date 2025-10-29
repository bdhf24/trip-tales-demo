import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Landing from "./pages/Landing";
import NewStory from "./pages/NewStory";
import StoryDemo from "./pages/StoryDemo";
import Story from "./pages/Story";
import Library from "./pages/Library";
import LibraryManager from "./pages/LibraryManager";
import Kids from "./pages/Kids";
import Settings from "./pages/Settings";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/new" element={<NewStory />} />
          <Route path="/library" element={<Library />} />
          <Route path="/library/manage" element={<LibraryManager />} />
          <Route path="/kids" element={<Kids />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/story/demo" element={<StoryDemo />} />
          <Route path="/story/:id" element={<Story />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
