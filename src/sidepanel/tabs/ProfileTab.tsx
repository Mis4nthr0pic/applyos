import React from "react";
import type { UserProfile } from "../../shared/types";
import { Button, Card, Field } from "../components/UI";

export function ProfileTab({ profile, onSave }: { profile?: UserProfile; onSave: (profile: UserProfile) => void }) {
  const [draft, setDraft] = React.useState<UserProfile>(profile ?? {});
  React.useEffect(() => setDraft(profile ?? {}), [profile]);
  const fields: Array<[keyof UserProfile, string, string]> = [
    ["firstName", "First name", "text"], ["lastName", "Last name", "text"], ["fullName", "Full name", "text"],
    ["email", "Email", "email"], ["phone", "Phone", "tel"], ["country", "Country", "text"],
    ["state", "State / Province", "text"], ["city", "City", "text"], ["linkedinUrl", "LinkedIn URL", "url"],
    ["githubUrl", "GitHub URL", "url"], ["portfolioUrl", "Portfolio URL", "url"], ["websiteUrl", "Website URL", "url"],
    ["workAuthorization", "Work authorization", "text"], ["visaSponsorship", "Visa sponsorship", "text"],
    ["salaryExpectation", "Salary expectation", "text"], ["startDate", "Start date", "text"]
  ];
  return (
    <div className="stack">
      <div className="section-heading"><div><h1>Profile</h1><p>Safe defaults used only after you click Insert or Autofill.</p></div></div>
      <Card className="form-grid">
        {fields.map(([key, label, type]) => (
          <Field key={key} label={label}><input type={type} value={String(draft[key] ?? "")} onChange={(e) => setDraft({ ...draft, [key]: e.target.value })} /></Field>
        ))}
        <Button variant="primary" onClick={() => onSave({ ...draft, id: "default" })}>Save Profile</Button>
      </Card>
    </div>
  );
}
