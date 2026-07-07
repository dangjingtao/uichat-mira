import SettingsLayoutFrame, {
  type SettingsLayoutFrameProps,
} from "./SettingsLayoutFrame";

export interface SettingsSubPageLayoutProps extends SettingsLayoutFrameProps {}

export default function SettingsSubPageLayout(
  props: SettingsSubPageLayoutProps,
) {
  return <SettingsLayoutFrame {...props} />;
}
