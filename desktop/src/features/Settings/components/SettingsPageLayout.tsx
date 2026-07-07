import SettingsLayoutFrame, {
  type SettingsLayoutFrameProps,
} from "./SettingsLayoutFrame";

export default function SettingsPageLayout({
  ...props
}: SettingsLayoutFrameProps) {
  return <SettingsLayoutFrame {...props} />;
}
