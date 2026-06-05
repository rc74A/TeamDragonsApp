# ATS Project: UX & Interface Blueprint

## 1. Core Philosophy & Flow
* **Landing Experience:** What does a user see immediately upon signing in to guide their next action? -> User will see Dashboard where applied/saved jobs will be.

* **The "One Product" Flow:** How do you ensure the app feels like one cohesive product instead of three separate sprints stitched together? -> Use a global styling across the whole project.  

## 2. Navigation Framework

* **Chosen Paradigm:** | Left Sidebar for the menu  | A static Top Header Bar will only display page titles and contextual data |  

* **Sprint Phasing Strategy:** How will you handle links for features not yet built in Sprint 1 or 2?  -> Greyed out


## 3. Dashboard & Job Board
* **Layout Model:** -> Card Grid
* **Job Detail View:** How do users view job details, notes, and change application status without leaving the page? ->Modal Overlay 


## 4. Candidate Profile
* **Form Layout:** -> Tabbed Sections 
* **Save Behavior:** -> Manual "Save Section" buttons
* **Completion Tracker:** How does the UI visually show profile progress? -> A progress bar widget at the top of the profile page that updates as user fills out fields. 

## 5. Document Library
* **Global Management:** How are resumes and cover letters organized globally (e.g., version labels, dates)? -> A data table listing all uploaded files with columns for File Name, Document Type (Resume/Cover Letter), Date Added, and a 'Primary' toggle label.

* **Dashboard Sync:** When a user creates a resume inside a specific job context, how does it sync back to the global library? -> Documents generated inside a job modal are automatically saved to the database linked to that specific job ID, and they will immediately show up in the global library view with a "Job-Specific" label.
 

## 6. Visual System
* **Primary Brand Color:** `#1E40AF` (Royal Blue)
* **Accent Color:** `#06B6D4` (Electric Cyan / Main Actions & Highlights)
* **Success/Error Colors:** Success: `#10B981` (Green) | Error: `#EF4444` (Red)
* **Typography (Font Family):** "Arial, sans-serif"

## 7. Responsive Matrix (Desktop-First)
*Describe how layout elements stack or collapse on smaller screens.*

| Component | Desktop Layout | Mobile Adaptation |
| :--- | :--- | :--- |
| **Navigation** | Persistent Left Sidebar | Collapses completely into a menu icon. Tapping the icon opens an overlay drawer showing all the usual navigation options. |
| **Job Board** | Multi-column Card Grid | Stacks vertically into a Single Column scrollable list. |
| **Job Details** | Center Modal Overlay | Full Screen Overlap |

* **Optional PWA Layer:** 

## 8. Launch Checklist
- [ ] Interface layout, buttons, and form styles are identical on every screen.
- [ ] Users never experience hidden context switches or get kicked back to the home page unexpectedly.
- [ ] Text sizes and margins follow a deliberate scale.