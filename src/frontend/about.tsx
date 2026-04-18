import {
  DialogBody,
  DialogButton,
  DialogControlsSection,
  DialogControlsSectionHeader,
  Field,
  Focusable,
  Navigation,
} from "@decky/ui";
import { formatDistanceToNow, fromUnixTime } from "date-fns";
import { HiOutlineQrCode } from "react-icons/hi2";
import { SiDiscord, SiGithub, SiKofi } from "react-icons/si";
import { AppState, UpdaterState } from "../types";
import { showQrModal } from "../components/showQrModal";
import { refreshCatalog } from "../utils/backendApi";

export default function About({
  appState,
  socket,
}: {
  appState: AppState | undefined;
  socket: WebSocket | undefined;
}) {
  return (
    <DialogBody>
      <DialogControlsSection>
        <div>
          <p>
            Wine Cellar is a compatibility tool manager for Steam. It can
            install tools directly, maintain reusable virtual compatibility
            slots, and show which tools the current Steam session has loaded.
          </p>
        </div>
        <DialogControlsSectionHeader>Wine Cellar</DialogControlsSectionHeader>
        <SystemInformation appState={appState} socket={socket} />
        <DialogControlsSectionHeader>
          Engage & Participate
        </DialogControlsSectionHeader>
        <ProjectInformation />
      </DialogControlsSection>
    </DialogBody>
  );
}

function SystemInformation({
  appState,
  socket,
}: {
  appState: AppState | undefined;
  socket: WebSocket | undefined;
}) {
  return (
    <Focusable style={{ display: "flex", flexDirection: "column" }}>
      {appState != undefined && socket != undefined && (
        <Field
          label={"Compatibility Tools Updates"}
          description={
            "Last checked: " +
            (appState.updater_last_check != null
              ? formatDistanceToNow(fromUnixTime(appState.updater_last_check)) +
                " ago"
              : "Never")
          }
          bottomSeparator={"none"}
        >
          <DialogButton
            disabled={appState.updater_state == UpdaterState.Checking}
            onClick={() => {
              refreshCatalog(socket);
            }}
          >
            {appState.updater_state == UpdaterState.Idle
              ? "Check For Updates"
              : "Checking..."}
          </DialogButton>
        </Field>
      )}
    </Focusable>
  );
}

function ProjectInformation() {
  const socialLinks = [
    {
      label: "GitHub",
      icon: <SiGithub />,
      link: "https://github.com/FlashyReese/decky-wine-cellar",
      buttonText: "Report an Issue",
    },
    {
      label: "Discord",
      icon: <SiDiscord />,
      link: "https://discord.gg/MPHVG6MH4e",
      buttonText: "Join Us",
    },
    {
      label: "Ko-fi",
      icon: <SiKofi />,
      link: "https://ko-fi.com/flashyreese",
      buttonText: "Support the Project!",
    },
  ];

  return (
    <Focusable style={{ display: "flex", flexDirection: "column" }}>
      {socialLinks.map((linkInfo, index) => (
        <Field
          key={index}
          label={linkInfo.label}
          icon={linkInfo.icon}
          bottomSeparator={"none"}
          padding={"none"}
        >
          <Focusable
            style={{
              marginLeft: "auto",
              boxShadow: "none",
              display: "flex",
              justifyContent: "right",
              padding: "4px",
            }}
          >
            <DialogButton
              onClick={() => {
                Navigation.NavigateToExternalWeb(linkInfo.link);
              }}
              style={{
                padding: "10px",
                fontSize: "14px",
              }}
            >
              {linkInfo.buttonText}
            </DialogButton>
            <DialogButton
              onClick={() => {
                showQrModal(linkInfo.link);
              }}
              style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                padding: "10px",
                maxWidth: "40px",
                minWidth: "auto",
                marginLeft: ".5em",
              }}
            >
              <HiOutlineQrCode />
            </DialogButton>
          </Focusable>
        </Field>
      ))}
    </Focusable>
  );
}
