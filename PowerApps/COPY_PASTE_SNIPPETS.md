# Copy-paste snippets – Draft save

Use these in your Integration Request app. See [DRAFT_SAVE_IMPLEMENTATION.md](DRAFT_SAVE_IMPLEMENTATION.md) for full context.

**If you get "Equals" or parsing errors:** Use `And` and `Not` (not `&&` and `!`), use `=` not `Equals()`, and remove all `//` and `/* */` comments. If your locale uses semicolon as the list separator, change commas between function arguments to semicolons in the formula bar.

**"Received 2, expected 1":** Power Fx's `First(table)` takes **only one argument**—there is no `First(table, default)`. The formula uses `If(CountRows(Filter(...)) > 0, First(Filter(...)), Blank())` for `varCurrentIntegration` instead.

---

## App OnStart (corrected, no comments)

Paste this into **App > OnStart**. It has no comments and uses only valid Power Fx (`And`, `Not`, `IfError(..., false)`).

```powerapps
ClearCollect(colIntegrations, Sort(Filter(tblIntegrations, Upper(Text(IsActive)) = "TRUE"), SortOrder, SortOrder.Ascending));
ClearCollect(colDraftState, { CompanyName: "", LuminanceUrl: "", TechEmail: "", SelectedIntegrationIDs: "", AnswersJSON: "[]", IntegrationIndex: 1, CurrentIntegrationID: "", AdditionalNotes: "", SavedAt: "" });
Clear(colDraftState);
IfError(LoadData(colDraftState, "IntegrationDraft"), false);
If(CountRows(colDraftState) > 0 And Not IsBlank(First(colDraftState).SavedAt), Set(varCompanyName, First(colDraftState).CompanyName); Set(varLuminanceUrl, First(colDraftState).LuminanceUrl); Set(varTechEmail, First(colDraftState).TechEmail); Set(varAdditionalNotes, First(colDraftState).AdditionalNotes); Set(varIntegrationIndex, First(colDraftState).IntegrationIndex); Set(varCurrentIntegration, If(CountRows(Filter(tblIntegrations, IntegrationID = First(colDraftState).CurrentIntegrationID)) > 0, First(Filter(tblIntegrations, IntegrationID = First(colDraftState).CurrentIntegrationID)), Blank())); Clear(colSelected); If(Not IsBlank(First(colDraftState).SelectedIntegrationIDs), Collect(colSelected, Filter(tblIntegrations, IntegrationID in Split(Trim(First(colDraftState).SelectedIntegrationIDs), ";")))); Clear(colAnswers); If(Not IsBlank(First(colDraftState).AnswersJSON) And First(colDraftState).AnswersJSON <> "[]", Collect(colAnswers, ForAll(ParseJSON(First(colDraftState).AnswersJSON), { IntegrationID: Text(ThisRecord.IntegrationID), FieldKey: Text(ThisRecord.FieldKey), Label: Text(ThisRecord.Label), Type: Text(ThisRecord.Type), Value: Text(ThisRecord.Value) }))); true, Clear(colSelected); Clear(colAnswers); Collect(colAnswers, { IntegrationID: "", FieldKey: "", Label: "", Type: "", Value: "" }); RemoveIf(colAnswers, FieldKey = ""); Set(varCompanyName, ""); Set(varLuminanceUrl, ""); Set(varTechEmail, ""); Set(varAdditionalNotes, ""); Set(varIntegrationIndex, Blank()); Set(varCurrentIntegration, Blank()); true);
```

If your environment still complains, use the **multi-line version** in [DRAFT_SAVE_IMPLEMENTATION.md](DRAFT_SAVE_IMPLEMENTATION.md) §3 and ensure every comment is removed before pasting.

---

## Silent SaveDraft (Option B – for Timer, Proceed, Next)

Paste into **Timer OnTimerEnd**, or into **Proceed / Next OnSelect** (before Navigate):

```powerapps
ClearCollect(colDraftState, {
    CompanyName: Coalesce(Trim(txtCompanyName.Text), varCompanyName, ""),
    LuminanceUrl: Coalesce(Trim(txtLuminanceURL.Text), varLuminanceUrl, ""),
    TechEmail: Coalesce(Trim(txtTechEmail.Text), varTechEmail, ""),
    SelectedIntegrationIDs: Concat(colSelected, IntegrationID, ";"),
    AnswersJSON: JSON(colAnswers, JSONFormat.Compact),
    IntegrationIndex: varIntegrationIndex,
    CurrentIntegrationID: Coalesce(varCurrentIntegration.IntegrationID, ""),
    AdditionalNotes: Coalesce(Trim(txtAdditionalNotes.Text), ""),
    SavedAt: Text(Now(), "yyyy-mm-dd hh:nn:ss")
});
SaveData(colDraftState, "IntegrationDraft")
```

---

## Clear draft at start of Final Submit

Add this as the **first line** of your **Final Submit** button **OnSelect**:

```powerapps
ClearData("IntegrationDraft");
```

---

## Timer setup (autosave every 60 seconds)

- Add a **Timer** control.
- **Duration**: `60000`
- **AutoStart**: `true`
- **Repeat**: `true`
- **OnTimerEnd**: paste the **Silent SaveDraft** block above.

---

## Text input binding (Default + OnChange)

| Control        | Default           | OnChange                          |
|----------------|-------------------|-----------------------------------|
| txtCompanyName | `varCompanyName`  | `Set(varCompanyName, Self.Text)`  |
| txtLuminanceURL| `varLuminanceUrl` | `Set(varLuminanceUrl, Self.Text)` |
| txtTechEmail   | `varTechEmail`    | `Set(varTechEmail, Self.Text)`    |
| txtAdditionalNotes | `varAdditionalNotes` | `Set(varAdditionalNotes, Self.Text)` |

Ensure `varCompanyName`, `varLuminanceUrl`, `varTechEmail`, and `varAdditionalNotes` are set in **App OnStart** (either from the restored draft or to `""` when there is no draft).

---

## galFields value control (txtFieldValueText / txtFieldValue)

Use **And** not **&&** in all LookUp conditions. If you use both controls, give them the same Default and OnChange.

**Default** (so restored drafts show the value for this integration/field):

```powerapps
Coalesce(LookUp(colAnswers, IntegrationID = varCurrentIntegration.IntegrationID And FieldKey = ThisItem.key).Value, "")
```

**OnChange** (if no row exists, Collect; else Patch):

```powerapps
If(
    IsBlank(LookUp(colAnswers, IntegrationID = varCurrentIntegration.IntegrationID And FieldKey = ThisItem.key)),
    Collect(colAnswers, { IntegrationID: varCurrentIntegration.IntegrationID, FieldKey: ThisItem.key, Label: ThisItem.Label, Type: ThisItem.Type, Value: Self.Text }),
    Patch(colAnswers, LookUp(colAnswers, IntegrationID = varCurrentIntegration.IntegrationID And FieldKey = ThisItem.key), { Value: Self.Text })
)
```

If your gallery item has no `Label` or `Type`, use only `IntegrationID`, `FieldKey`, `Value` in the Collect. **OnSelect** can stay as `Select(Parent)` if you use it for focus.
