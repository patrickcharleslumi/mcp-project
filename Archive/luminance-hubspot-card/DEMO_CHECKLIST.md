# Demo Preparation Checklist

Complete checklist for preparing and delivering a professional demo of the Luminance-HubSpot integration.

## Pre-Demo Setup (1-2 Days Before)

### Technical Setup

- [ ] **Prismatic Integration Verified**
  - [ ] Webhook URL is active and responding
  - [ ] Test contract generation with Postman
  - [ ] Verify response format (see PRISMATIC_RESPONSE_GUIDE.md)
  - [ ] Confirm authentication is working

- [ ] **HubSpot Environment Ready**
  - [ ] Sandbox account accessible
  - [ ] Custom deal properties created
  - [ ] CRM card deployed and visible
  - [ ] Test deal created with realistic data

- [ ] **Code Deployed**
  - [ ] Latest code uploaded to HubSpot (`npm run upload`)
  - [ ] No console errors in browser
  - [ ] All features working in sandbox
  - [ ] Response parsing verified

- [ ] **Luminance Access**
  - [ ] Can log into Luminance
  - [ ] Contract templates (NDA, DPA) exist
  - [ ] Know how to navigate to generated contracts

### Demo Data Setup

- [ ] **Create Demo Deal**
  ```
  Deal Name: Acme Corporation - Enterprise Agreement
  Amount: $250,000
  Stage: Negotiation
  Close Date: [End of current quarter]
  Company: Acme Corporation
  Priority: High
  Owner: [Your name]
  ```

- [ ] **Clear Previous Test Data**
  - [ ] Remove test contracts from previous runs
  - [ ] Clear any error states in the CRM card
  - [ ] Ensure deal properties are empty or have expected values

- [ ] **Prepare Backup Demo Deal**
  - [ ] Second deal in case of issues
  - [ ] Different deal amount and stage for variety

### Testing

- [ ] **Complete End-to-End Test (3x minimum)**
  1. Open deal in HubSpot
  2. Find CRM card in sidebar
  3. Deal information displays correctly
  4. Select NDA template
  5. Add notes: "Urgent - Board meeting Thursday"
  6. Click "Generate Contract in Luminance"
  7. Loading state appears
  8. Success message displays
  9. Contract link appears
  10. Click link - opens in Luminance
  11. Contract exists and is populated correctly
  12. Return to HubSpot - deal properties updated

- [ ] **Test Both Contract Types**
  - [ ] Generate NDA contract successfully
  - [ ] Generate DPA contract successfully

- [ ] **Test Error Handling**
  - [ ] Try with empty form (validation should prevent)
  - [ ] Verify error messages are clear
  - [ ] Test "Try Again" button works

- [ ] **Cross-Browser Test** (if presenting on different device)
  - [ ] Chrome
  - [ ] Safari (if on Mac)
  - [ ] Edge (if presenting from Windows)

### Recording Setup (If Recording Demo)

- [ ] **Hardware Check**
  - [ ] Microphone tested and clear
  - [ ] Webcam positioned well (if showing face)
  - [ ] Good lighting setup
  - [ ] Quiet environment

- [ ] **Software Setup**
  - [ ] Screen recording software tested (Loom, QuickTime, OBS)
  - [ ] Recording quality set to high (1080p minimum)
  - [ ] Audio levels tested
  - [ ] Know how to start/stop recording

- [ ] **Desktop Preparation**
  - [ ] Clean desktop background
  - [ ] Close unnecessary applications
  - [ ] Disable notifications (Do Not Disturb mode)
  - [ ] Close extra browser tabs
  - [ ] Clear browser history/cache
  - [ ] Hide bookmarks bar (optional - for cleaner look)
  - [ ] Set browser zoom to 100%

## Day of Demo

### Final Checks (30 minutes before)

- [ ] **Restart Everything**
  - [ ] Restart computer for fresh start
  - [ ] Clear browser cache
  - [ ] Close all unnecessary apps

- [ ] **Test Internet Connection**
  - [ ] Speed test (ensure good connection)
  - [ ] Test Prismatic webhook with Postman
  - [ ] Load HubSpot sandbox
  - [ ] Test Luminance login

- [ ] **Verify Demo Deal**
  - [ ] Deal still exists with correct data
  - [ ] CRM card visible on deal page
  - [ ] No leftover contract from previous test
  - [ ] Deal properties are clean

- [ ] **One Final Test Run**
  - [ ] Complete full flow one more time
  - [ ] Time the flow (should be < 30 seconds)
  - [ ] Verify contract generates successfully

- [ ] **Prepare Talking Points**
  - [ ] Review script (see below)
  - [ ] Practice transitions between steps
  - [ ] Prepare answers to common questions

### Backup Plans

- [ ] **If Live Demo Fails**
  - [ ] Have recorded demo ready as backup
  - [ ] Screenshots of key screens ready
  - [ ] Able to explain what should happen

- [ ] **If Prismatic is Down**
  - [ ] Contact information for support
  - [ ] Alternative date/time for demo
  - [ ] Explanation of architecture ready

- [ ] **If HubSpot is Slow**
  - [ ] Be patient, don't rush
  - [ ] Explain that loading times vary
  - [ ] Have coffee/conversation ready to fill time

## Demo Script

### Introduction (30 seconds)

"Today I'm going to show you our Luminance-HubSpot integration that enables sales teams to generate contracts directly from deal records with just one click."

### Step 1: Show Deal Record (15 seconds)

"Here we have a deal for Acme Corporation in our HubSpot CRM. This is a $250,000 enterprise agreement currently in the negotiation stage."

**[Navigate to Deals, open demo deal]**

### Step 2: Highlight CRM Card (10 seconds)

"In the right sidebar, you'll notice our Luminance Contracts card. It automatically pulls in all the key deal information - the opportunity name, amount, stage, and record ID."

**[Scroll to show CRM card, point to deal information]**

### Step 3: Show Form (15 seconds)

"To generate a contract, we simply select the appropriate template - in this case, I'll choose an NDA - and we can add any additional notes or special instructions."

**[Select NDA from dropdown]**
**[Type in notes field: "Urgent - Board meeting Thursday"]**

### Step 4: Generate Contract (10 seconds)

"Now with just one click..."

**[Click "Generate Contract in Luminance" button]**

### Step 5: Show Loading State (5 seconds)

"The integration works in real-time, communicating with Luminance through our Prismatic middleware."

**[Show loading spinner]**

### Step 6: Show Success (10 seconds)

"And there we go - contract generated successfully! The integration automatically stores the contract URL in the deal properties for future reference."

**[Point to success message and contract link]**

### Step 7: Open in Luminance (15 seconds)

"Let's open the contract in Luminance to verify everything populated correctly."

**[Click contract link]**
**[Show contract in Luminance]**

### Step 8: Show Populated Data (15 seconds)

"As you can see, the contract has been fully populated with all the deal information - company name, deal amount, and the notes we added. The sales team can now review and send this directly to the client."

**[Scroll through contract to show populated fields]**

### Conclusion (15 seconds)

"This integration eliminates manual data entry, reduces errors, and accelerates the contract generation process from hours to seconds. Sales teams can focus on selling instead of administrative tasks."

### Total Time: ~2-3 minutes

## Common Questions & Answers

### Q: "How long does it take to generate a contract?"

**A**: "Typically 5-10 seconds. The speed depends on the complexity of the contract template and the current load on Luminance's system."

### Q: "What happens if there's an error?"

**A**: "The CRM card displays a clear error message and provides a 'Try Again' button. All errors are logged for troubleshooting."

### Q: "Can you customize the contract templates?"

**A**: "Yes, contract templates are managed in Luminance. You can add as many templates as needed, and they'll automatically appear in the dropdown."

### Q: "Does this work with other HubSpot objects?"

**A**: "Currently it's configured for Deals, but the architecture supports expansion to Companies, Contacts, or any HubSpot object."

### Q: "What about security and authentication?"

**A**: "All authentication is handled securely through Prismatic using OAuth 2.0 and HMAC signatures. No credentials are stored in the CRM card code."

### Q: "Can multiple team members use this?"

**A**: "Yes, the CRM card is available to all users with access to deal records. Permissions are managed through HubSpot's standard role-based access control."

### Q: "What if someone generates a contract twice?"

**A**: "The card stores the contract URL, so users can see if a contract already exists. If they generate another one, it will create a new contract version."

### Q: "Does this work on mobile?"

**A**: "The CRM card is designed for desktop use, but HubSpot's mobile app may support it with some layout adjustments."

## Post-Demo Follow-Up

### Immediate Actions

- [ ] **Send Thank You Email**
  - Include recording link (if recorded)
  - Attach relevant documentation
  - Offer to answer questions

- [ ] **Share Demo Materials**
  - Link to demo video
  - PDF of architecture diagram
  - Feature list document

### Feedback Collection

- [ ] **Ask for Feedback**
  - What did they like most?
  - Any concerns or hesitations?
  - What features would be most valuable?
  - Timeline for decision?

- [ ] **Technical Questions**
  - Do they have questions about implementation?
  - Security or compliance concerns?
  - Integration with other systems?

### Next Steps

- [ ] **Schedule Follow-Up**
  - Technical deep-dive if needed
  - Meeting with decision makers
  - Proof of concept planning

- [ ] **Document Feedback**
  - Note feature requests
  - Identify potential blockers
  - Track competitive considerations

## Demo Day Checklist (Print This!)

### 2 Hours Before
- [ ] Restart computer
- [ ] Clear browser cache
- [ ] Test internet connection
- [ ] Load HubSpot sandbox
- [ ] Verify demo deal exists
- [ ] Test Prismatic webhook
- [ ] Log into Luminance

### 30 Minutes Before
- [ ] Close all extra apps
- [ ] Enable Do Not Disturb
- [ ] One final end-to-end test
- [ ] Open demo deal in new tab
- [ ] Have backup recording ready
- [ ] Review talking points
- [ ] Deep breath!

### 5 Minutes Before
- [ ] Open demo deal
- [ ] Zoom to comfortable level
- [ ] Position browser window
- [ ] Start recording (if recording)
- [ ] Silence phone
- [ ] Get water nearby

### During Demo
- [ ] Speak clearly and confidently
- [ ] Don't rush - take your time
- [ ] If something fails, stay calm
- [ ] Use backup plan if needed
- [ ] Smile (if on camera)

### After Demo
- [ ] Stop recording
- [ ] Save recording file
- [ ] Send follow-up email
- [ ] Document feedback
- [ ] Plan next steps

## Success Metrics

A successful demo should result in:
- [ ] Client understands the value proposition
- [ ] Technical feasibility demonstrated
- [ ] Clear next steps agreed upon
- [ ] Positive feedback received
- [ ] Decision timeline established

## Emergency Contacts

**Prismatic Support**: [Add contact info]
**HubSpot Support**: [Add contact info]
**Luminance Support**: [Add contact info]
**Your Manager**: [Add contact info]

## Notes Section

Use this space for any additional notes or observations:

---

**Last Updated**: [Date]
**Demo Date**: [Scheduled date/time]
**Audience**: [Names and roles]
**Demo Duration**: [Target: 2-3 minutes]

---

Good luck! You've got this! 🚀
