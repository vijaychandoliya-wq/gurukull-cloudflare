# School workbook import format

Download `gurukull-school-import-template.xlsx` from **Academics → Bulk import**. Keep the sheet names unchanged. The importer validates every row before saving anything and reports the sheet and row number for rejected data.

| Sheet | Required columns | Notes |
| --- | --- | --- |
| `classes` | `name` | `code` is the stable optional code; `sortOrder` is numeric. Existing matching code/name is reused. |
| `sections` | `name`, `classCode` or `className` | The class must exist in the workbook or school. |
| `teachers` | `name`, `email`, `mobile`, `employeeId`, `designation`, `joiningDate` | `jobType` is `full_time` or `part_time`; login keys are issued separately. |
| `students` | `name`, `registrationNumber`, `rollNumber`, `className`, `sectionName`, `enrollmentDate` | The class and section must match the current academic year. |
| `parents` | `firstName`, `mobile`, `linkedStudentAdmissions`, `relationship` | Separate multiple admission numbers with `;`. `profession` and `annualIncome` are optional; if supplied, use the documented occupation values and an integer income. |

The workbook uses actual school records only. Blank or invented people are rejected rather than persisted.
