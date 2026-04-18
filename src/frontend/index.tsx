import { SidebarNavigation, SidebarNavigationPage } from "@decky/ui";
import { useEffect, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { AppState, MessageEnvelope, MessageType } from "../types";
import { log } from "../utils/logger";
import { reportSteamVisibleTools, requestState } from "../utils/backendApi";
import About from "./about";
import FlavorTab from "./flavorTab";
import ManagerTab from "./manager";

export default function ManagePage() {
  const [appState, setAppState] = useState<AppState | undefined>();
  const [socket, setSocket] = useState<WebSocket>();

  useEffect(() => {
    const websocket = new WebSocket("ws://localhost:8887");
    const uniqueId = uuidv4();

    setSocket(websocket);

    websocket.onopen = async () => {
      log("WebSocket connection established. Unique Identifier:", uniqueId);
      requestState(websocket);
      await reportSteamVisibleTools(websocket);
    };

    websocket.onmessage = (event) => {
      const response: MessageEnvelope = JSON.parse(event.data);
      if (response.type === MessageType.UpdateState && response.app_state != null) {
        setAppState(response.app_state);
        log("Received app state update");
      } else if (
        response.type === MessageType.UpdateOperations &&
        response.operation_state != null
      ) {
        setAppState((currentState) => {
          if (currentState == null) {
            return currentState;
          }

          return {
            ...currentState,
            current_operation: response.operation_state?.current_operation,
            queued_operations: response.operation_state?.queued_operations ?? [],
          };
        });
      }
    };

    websocket.onerror = (error) => {
      log("WebSocket error:", error);
    };

    websocket.onclose = () => {
      log("WebSocket connection closed. Unique Identifier:", uniqueId);
    };

    return () => {
      websocket.close();
    };
  }, []);

  const pages: (SidebarNavigationPage | "separator")[] = [];

  if (appState != null && socket != null) {
    pages.push({
      title: "Dashboard",
      content: <ManagerTab appState={appState} socket={socket} />,
      route: "/wine-cellar/dashboard",
    });

    appState.catalog_flavors.forEach((flavor) => {
      pages.push({
        title: flavor.flavor,
        content: <FlavorTab appState={appState} flavor={flavor} socket={socket} />,
        route: "/wine-cellar/" + flavor.flavor,
      });
    });
  } else {
    pages.push({
      title: "Preparing...",
      content: (
        <div>
          Hang tight! We&apos;re preparing your Wine Cellar experience. If this
          takes longer than expected, the backend may have failed to start.
        </div>
      ),
      route: "/wine-cellar/preparing",
    });
  }

  pages.push({
    title: "About",
    content: <About appState={appState} socket={socket} />,
    route: "/wine-cellar/about",
  });

  return <SidebarNavigation title="Wine Cellar" showTitle pages={pages} />;
}
