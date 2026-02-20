import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import FloatingEmber from "./components/FloatingEmber";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import EmberChat from "./pages/EmberChat";
import Subscription from "./pages/Subscription";
import EmberMemory from "./pages/EmberMemory";

function Router() {
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/ember"} component={EmberChat} />
      <Route path={"/subscription"} component={Subscription} />
      <Route path={"/memory"} component={EmberMemory} />
      <Route path={"/404"} component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster />
          <Router />
          <FloatingEmber />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
