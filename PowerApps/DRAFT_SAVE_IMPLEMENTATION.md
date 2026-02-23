# Draft Save Implementation – Integration Request App

This guide makes your Integration Request Power App **save-friendly** so that if a user leaves mid-form (e.g. to get more information), their progress is kept and restored when they return.

Approach:

- **SaveData / LoadData** – Store one “draft” collection locally under a fixed name.
- **Single draft record** – One row holds: CompanyName, LuminanceUrl, TechEmail, selected integration IDs, `colAnswers` as JSON, integration index/current, AdditionalNotes, SavedAt.
- **Variables for main fields** – `varCompanyName`, `varLuminanceUrl`, `varTechEmail` (and where useful, `varAdditionalNotes`) are the source of truth; text inputs use them as **Default** and **Update** context.
- **Autosave** – Save the draft on a timer and on important transitions (e.g. “Proceed”, “Next” on each integration, and optionally OnBlur on key inputs).
- **Clear draft on submit** – On successful Final Submit, call **ClearData** for the draft and then do your existing cleanup.

---

## 1. Storage and naming

- **Draft collection:** `colDraftState`
- **Storage name:** `"IntegrationDraft"` (used in SaveData / LoadData / ClearData).  
  Do not use: `* " . ? : \ < > | /`

**Note:** SaveData/LoadData work in **Power Apps Mobile and Desktop**. In **browsers** they may not be available or may have a 1 MB limit. If your users only run the app in a browser, use a **Drafts** table in SharePoint (or another data source) and Patch/Load instead of SaveData/LoadData; the “one record per draft” and “clear on submit” patterns below still apply.

---

## 2. Draft record shape

Use **one row** in `colDraftState` with at least these columns:

| Column | Type | Meaning |
|--------|------|--------|
| `CompanyName` | Text | Same as `txtCompanyName` |
| `LuminanceUrl` | Text | Same as `txtLuminanceURL` |
| `TechEmail` | Text | Same as `txtTechEmail` |
| `SelectedIntegrationIDs` | Text | Semicolon-separated IDs, e.g. `"id1;id2;id3"` |
| `AnswersJSON` | Text | `JSON(colAnswers, JSONFormat.Compact)` |
| `IntegrationIndex` | Number | Current step in the integration list (e.g. `varIntegrationIndex`) |
| `CurrentIntegrationID` | Text | `varCurrentIntegration.IntegrationID` or "" |
| `AdditionalNotes` | Text | Same as `txtAdditionalNotes` |
| `SavedAt` | Text | e.g. `Text(Now(), "yyyy-mm-dd hh:nn:ss")` |

You can add more columns later (e.g. screen name) if you need to restore to a specific screen.

---

## 3. App OnStart (with LoadData and optional draft restore)

Replace your current **App OnStart** with logic that:

1. Initializes `colIntegrations` (unchanged).
2. Ensures `colDraftState` exists, then tries to load and restore a draft.
3. If a valid draft exists, restores variables and `colSelected` / `colAnswers`; otherwise starts clean.

Use this as the **App OnStart** formula. It has **no comments** so it parses reliably in all contexts. If your app uses a locale where the list separator is **semicolon** (e.g. many European locales), change every **comma** between function arguments to **semicolon** in the formula bar.

```powerapps
ClearCollect(
    colIntegrations,
    Sort(
        Filter(tblIntegrations, Upper(Text(IsActive)) = "TRUE"),
        SortOrder,
        SortOrder.Ascending
    )
);

ClearCollect(colDraftState, {
    CompanyName: "",
    LuminanceUrl: "",
    TechEmail: "",
    SelectedIntegrationIDs: "",
    AnswersJSON: "[]",
    IntegrationIndex: 1,
    CurrentIntegrationID: "",
    AdditionalNotes: "",
    SavedAt: ""
});
Clear(colDraftState);
IfError(LoadData(colDraftState, "IntegrationDraft"), false);

If(
    CountRows(colDraftState) > 0 And Not IsBlank(First(colDraftState).SavedAt),
    Set(varCompanyName, First(colDraftState).CompanyName);
    Set(varLuminanceUrl, First(colDraftState).LuminanceUrl);
    Set(varTechEmail, First(colDraftState).TechEmail);
    Set(varAdditionalNotes, First(colDraftState).AdditionalNotes);
    Set(varIntegrationIndex, First(colDraftState).IntegrationIndex);
    Set(varCurrentIntegration,
        If(
            CountRows(Filter(tblIntegrations, IntegrationID = First(colDraftState).CurrentIntegrationID)) > 0,
            First(Filter(tblIntegrations, IntegrationID = First(colDraftState).CurrentIntegrationID)),
            Blank()
        )
    );
    Clear(colSelected);
    If(
        Not IsBlank(First(colDraftState).SelectedIntegrationIDs),
        Collect(
            colSelected,
            Filter(
                tblIntegrations,
                IntegrationID in Split(Trim(First(colDraftState).SelectedIntegrationIDs), ";")
            )
        )
    );
    Clear(colAnswers);
    If(
        Not IsBlank(First(colDraftState).AnswersJSON) And First(colDraftState).AnswersJSON <> "[]",
        Collect(
            colAnswers,
            ForAll(
                ParseJSON(First(colDraftState).AnswersJSON),
                {
                    IntegrationID: Text(ThisRecord.IntegrationID),
                    FieldKey: Text(ThisRecord.FieldKey),
                    Label: Text(ThisRecord.Label),
                    Type: Text(ThisRecord.Type),
                    Value: Text(ThisRecord.Value)
                }
            )
        ),
        Collect(colAnswers, { IntegrationID: "", FieldKey: "", Label: "", Type: "", Value: "" }); RemoveIf(colAnswers, FieldKey = "")
    );
    true,
    Clear(colSelected);
    Clear(colAnswers);
    Collect(colAnswers, { IntegrationID: "", FieldKey: "", Label: "", Type: "", Value: "" });
    RemoveIf(colAnswers, FieldKey = "");
    Set(varCompanyName, "");
    Set(varLuminanceUrl, "");
    Set(varTechEmail, "");
    Set(varAdditionalNotes, "");
    Set(varIntegrationIndex, Blank());
    Set(varCurrentIntegration, Blank());
    true
);
```

Adjust the “no answers in draft” branch if you prefer to always start with your original placeholder row instead of empty.

**Delegation:** If `IsActive` is stored as a **boolean** in your data source, use `IsActive = true` instead of `Upper(Text(IsActive)) = "TRUE"` so the filter can delegate: `Filter(tblIntegrations, IsActive = true)`.

**If you see "Equals" or parsing errors:** Power Fx has no `Equals(a, b)` function—use the `=` operator. Remove any `//` or `/* */` comments; the formula above has none. Use `IfError(..., false)` not `/* ... */` as the fallback. Use `And` and `Not`, not `&&` and `!`.

**"Invalid number of arguments: received 2, expected 1":** Power Fx's `First(table)` takes **only one argument**. There is no `First(table, default)`. To safely get the first row or blank when the table is empty, use: `If(CountRows(Filter(...)) > 0, First(Filter(...)), Blank())`. The formula above uses this pattern for `varCurrentIntegration`.

---

## 4. SaveDraft formula (reusable)

Use this in a **Button** or **Timer** or **OnBlur** so you can call “save draft” from several places. It builds one row from the current state and saves it.

**Option A – Define a reusable formula via a Button**

Create a **Button** (e.g. invisible or on a “Save draft” screen), set **OnSelect** to:

```powerapps
// Build current draft row
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
SaveData(colDraftState, "IntegrationDraft");
Notify("Progress saved.", NotificationType.Information)
```

Power Apps doesn’t support named formulas, so you **reuse** this by:

- Copying the same block into every **OnSelect**/OnTimerEnd/OnBlur where you want to save, or
- Using a **Timer** that runs this every 60 seconds (see below).

**Option B – Same logic without Notify (for autosave)**

Use the same `ClearCollect` + `SaveData` block but **omit** the `Notify` so autosave is silent:

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

Use **Option B** in the Timer and in “Next” / “Proceed” so it doesn’t interrupt the user.

---

## 5. Where to call SaveDraft (autosave and key transitions)

- **Timer (autosave)**  
  - Add a **Timer** control.  
  - **Duration** = 60000 (60 seconds).  
  - **AutoStart** = true, **Repeat** = true.  
  - **OnTimerEnd** = paste the **Option B** block (silent save).

- **Proceed with Selection (OnSelect)**  
  - Keep your existing validation (Company, URL, Email, at least one integration).  
  - After validation, **before** building `colSelectedQueue` and navigating, run the **Option B** save block once.  
  - Then continue with your current logic (Set vars, ClearCollect colSelectedQueue, Clear colAnswers, set index/current, Navigate).

- **“Next” on each integration screen**  
  - When the user moves to the next integration (or to the final screen), run the **Option B** block once before navigating.  
  - That way each step is persisted.

- **Optional: OnBlur on main fields**  
  - For `txtCompanyName`, `txtLuminanceURL`, `txtTechEmail`, `txtAdditionalNotes`: set **OnBlur** to the **Option B** block so leaving the field saves immediately.  
  - Only add this if you’re sure those controls exist on the current screen; otherwise use Timer + Proceed + Next.

---

## 6. Binding main text inputs to variables (save-friendly)

So that restored drafts show up in the UI and SaveDraft always has the latest value:

- **Default**  
  - `txtCompanyName`: **Default** = `varCompanyName`  
  - `txtLuminanceURL`: **Default** = `varLuminanceUrl`  
  - `txtTechEmail`: **Default** = `varTechEmail`  
  - `txtAdditionalNotes`: **Default** = `varAdditionalNotes`

- **OnChange (keep vars in sync)**  
  When the user types, update the variable so draft and UI stay aligned:

  - `txtCompanyName` **OnChange**: `Set(varCompanyName, Self.Text)`
  - `txtLuminanceURL` **OnChange**: `Set(varLuminanceUrl, Self.Text)`
  - `txtTechEmail` **OnChange**: `Set(varTechEmail, Self.Text)`
  - `txtAdditionalNotes` **OnChange**: `Set(varAdditionalNotes, Self.Text)`

Your Submit logic already uses `txtCompanyName.Text` etc.; with Default and OnChange, those values match the variables and the draft.

---

## 6a. galFields text inputs (per-integration fields)

The integration-step screen uses a gallery (`galFields`) whose items come from the current integration’s JSON. Each item has a key (e.g. `docusign_api_account_id`, `docusign_account_base_url`) and the control that holds the value is the one that must be bound to `colAnswers` so draft restore and submit work.

Use **one** of the patterns below for the **value** control (e.g. `txtFieldValueText` or `txtFieldValue`, depending which one you use for the value).

### Power Fx fix: use `And` not `&&`

In all `LookUp` conditions use **`And`**, not **`&&`**, e.g.:

- Wrong: `IntegrationID = varCurrentIntegration.IntegrationID && FieldKey = ThisItem.key`
- Right: `IntegrationID = varCurrentIntegration.IntegrationID And FieldKey = ThisItem.key`

### Recommended: one value control with Default + OnChange

**Default** (so restored drafts show the right value for this integration/field):

```powerapps
Coalesce(
    LookUp(
        colAnswers,
        IntegrationID = varCurrentIntegration.IntegrationID And FieldKey = ThisItem.key
    ).Value,
    ""
)
```

**OnChange** (update `colAnswers` when the user types; use “if no row then Collect, else Patch” so it works the same for new and existing rows):

```powerapps
If(
    IsBlank(
        LookUp(colAnswers, IntegrationID = varCurrentIntegration.IntegrationID And FieldKey = ThisItem.key)
    ),
    Collect(
        colAnswers,
        {
            IntegrationID: varCurrentIntegration.IntegrationID,
            FieldKey: ThisItem.key,
            Label: ThisItem.Label,
            Type: ThisItem.Type,
            Value: Self.Text
        }
    ),
    Patch(
        colAnswers,
        LookUp(colAnswers, IntegrationID = varCurrentIntegration.IntegrationID And FieldKey = ThisItem.key),
        { Value: Self.Text }
    )
)
```

If your gallery item doesn’t have `Label` or `Type`, use only the columns you have, e.g. `IntegrationID`, `FieldKey`, `Value`. The draft still restores as long as `colAnswers` has rows with `IntegrationID`, `FieldKey`, and `Value`.

### If you use two controls (e.g. `txtFieldValueText` and `txtFieldValue`)

Use the **same** Default and OnChange on **both**:

- **Default:** `Coalesce(LookUp(colAnswers, IntegrationID = varCurrentIntegration.IntegrationID And FieldKey = ThisItem.key).Value, "")`
- **OnChange:** the If/Collect/Patch block above (with or without `Label`/`Type` in the Collect).

That way, whichever control is visible for a given field type, it reads and writes the same `colAnswers` row, and restored drafts show correctly for the current integration and field.

### Optional: OnSelect on the value control

If you use `Select(Parent)` (or similar) for focus or gallery behaviour, keep it:

- **OnSelect:** `Select(Parent)`  
  and put the **OnChange** logic only in **OnChange**, so every keystroke still updates `colAnswers`.

### Why this restores correctly

On **App OnStart**, when a draft exists, `colAnswers` is refilled from the draft’s `AnswersJSON`. Each row has `IntegrationID`, `FieldKey`, `Label`, `Type`, `Value`. When the user is on an integration step, `varCurrentIntegration` is set and `galFields` is bound to that integration’s fields. For each item, `ThisItem.key` is the field key, so:

`LookUp(colAnswers, IntegrationID = varCurrentIntegration.IntegrationID And FieldKey = ThisItem.key).Value`

returns the saved value for that integration and field. **Default** uses that (or `""`), so the text box shows the restored value. **OnChange** writes back into the same row (or adds it), so the next draft save (Timer or Next) persists it.

---

## 7. Proceed with Selection (OnSelect) – include save

Keep your validation and navigation; add a **silent save** at the start of the “success” branch (after you’ve set the three vars and built `colSelectedQueue`), and **keep using** `varCompanyName` etc. so the draft reflects the same values you’re about to show on the next screen.

Example shape:

```powerapps
If(
    IsBlank(txtCompanyName.Text) Or IsBlank(txtLuminanceURL.Text) Or IsBlank(txtTechEmail.Text) Or CountRows(colSelected) = 0,
    Notify("Please enter Company Name, Luminance URL, Technical Contact Email, and select at least one integration.", NotificationType.Error),
    Set(varCompanyName, Trim(txtCompanyName.Text));
    Set(varLuminanceUrl, Trim(txtLuminanceURL.Text));
    Set(varTechEmail, Trim(txtTechEmail.Text));
    ClearCollect(colDraftState, {
        CompanyName: varCompanyName,
        LuminanceUrl: varLuminanceUrl,
        TechEmail: varTechEmail,
        SelectedIntegrationIDs: Concat(colSelected, IntegrationID, ";"),
        AnswersJSON: JSON(colAnswers, JSONFormat.Compact),
        IntegrationIndex: 1,
        CurrentIntegrationID: "",
        AdditionalNotes: Coalesce(Trim(txtAdditionalNotes.Text), ""),
        SavedAt: Text(Now(), "yyyy-mm-dd hh:nn:ss")
    });
    SaveData(colDraftState, "IntegrationDraft");
    ClearCollect(colSelectedQueue, Sort(Filter(tblIntegrations, IntegrationID in colSelected.IntegrationID), Value(SortOrder), SortOrder.Ascending));
    Clear(colAnswers);
    Set(varIntegrationIndex, 1);
    Set(varCurrentIntegration, First(colSelectedQueue));
    Navigate(scrIntegration, ScreenTransition.Cover)
)
```

---

## 8. Final Submit (OnSelect) – clear draft then cleanup

At the **very beginning** of your submit logic, clear the stored draft so a future session doesn’t restore an old draft. Then do the rest of your submit and cleanup as today.

Add this at the **top** of your **Final Submit** **OnSelect**:

```powerapps
ClearData("IntegrationDraft");
```

Then keep the rest of your Final Submit as-is (create `varSubmissionId`, Patch `tblSubmissions`, Notify, Clear collections and vars, Reset inputs, Navigate to scrStart).

Summary of what Final Submit does in order:

1. **ClearData("IntegrationDraft")** – wipe saved draft.
2. Create submission id and Patch `tblSubmissions` (all existing logic).
3. Notify success.
4. Clear `colSelected`, `colSelectedQueue`, `colAnswers`, reset vars, Reset controls, Navigate to start.

---

## 9. Checklist

- [ ] Add **colDraftState** and **App OnStart** (LoadData + restore) as in §3.
- [ ] Set **Default** and **OnChange** on `txtCompanyName`, `txtLuminanceURL`, `txtTechEmail`, `txtAdditionalNotes` as in §6.
- [ ] Set **Default** and **OnChange** on the galFields value control(s) (`txtFieldValueText` / `txtFieldValue`) as in §6a, using **And** not **&&** in LookUp.
- [ ] Add a **Timer** (e.g. 60 s) with **OnTimerEnd** = silent SaveDraft (§5, Option B).
- [ ] In **Proceed with Selection**, run the SaveDraft block (Option B or inline) before building `colSelectedQueue` and navigating (§7).
- [ ] On each integration **Next** button, run the same SaveDraft block before navigating (§5).
- [ ] At the start of **Final Submit**, call **ClearData("IntegrationDraft")** (§8).
- [ ] Test: fill part of the form, close app (or simulate leaving), reopen and confirm draft restores.
- [ ] Test: complete and submit, then reopen and confirm no draft is restored.

---

## 10. If SaveData/LoadData aren’t available (e.g. browser-only)

Use a **Drafts** table in SharePoint (or another data source) with columns matching the draft row (CompanyName, LuminanceUrl, TechEmail, SelectedIntegrationIDs, AnswersJSON, IntegrationIndex, CurrentIntegrationID, AdditionalNotes, SavedAt, and e.g. **UserId** if you want one draft per user).

- **OnStart:** Look up the current user’s draft row; if found, load it into `colDraftState` (or straight into vars + `colSelected` + `colAnswers`) and restore as in §3.
- **SaveDraft:** Patch that draft row (or create one) with the same values you would put in `colDraftState`, instead of calling SaveData.
- **Clear draft on submit:** Patch the draft row to blank/delete it, or set a “Submitted” flag and ignore it in OnStart.

The “one record per draft” and “clear on submit” behaviour stay the same; only the storage mechanism changes from local SaveData/LoadData to your data source.
