import { describe, it, expect } from "vitest"
import {
  buildWorkflowSteps,
  mapLegacyStepToId,
  WORKFLOW_PRESETS,
  ALL_WORKFLOW_STEPS,
  type WorkflowContext,
} from "@/lib/workflow/step-registry"

describe("Workflow Step Registry", () => {
  it("builds standard 6-step workflow correctly", () => {
    const steps = buildWorkflowSteps("standard_6_step")
    expect(steps).toHaveLength(6)
    expect(steps[0].id).toBe("document_integrity")
    expect(steps[0].number).toBe(1)
    expect(steps[1].id).toBe("text_understanding")
    expect(steps[1].number).toBe(2)
    expect(steps[5].id).toBe("verification_and_export")
    expect(steps[5].number).toBe(6)
  })

  it("builds academic full 10-step workflow correctly", () => {
    const steps = buildWorkflowSteps("academic_full_10_step")
    expect(steps).toHaveLength(10)
    expect(steps.map((s) => s.id)).toEqual([
      "document_integrity",
      "plagiarism_check",
      "supervisor_signoff",
      "text_understanding",
      "plan_and_rubric",
      "evidence_analysis",
      "draft_review",
      "verification_and_export",
      "reviewer_calibration",
      "defense_prep",
    ])
    expect(steps[9].number).toBe(10)
  })

  it("builds legacy fast 4-step workflow correctly", () => {
    const steps = buildWorkflowSteps("fast_4_step")
    expect(steps).toHaveLength(4)
    expect(steps.map((s) => s.id)).toEqual([
      "document_integrity",
      "text_understanding",
      "evidence_analysis",
      "draft_review",
    ])
  })

  it("evaluates step checkDone and checkAvailable functions accurately", () => {
    const ctxEmpty: WorkflowContext = {
      hasDocument: false,
      isParsing: false,
      isIndexed: false,
      chunkCount: 0,
      isFormValid: false,
      hasPlan: false,
      hasReview: false,
      isConfirmed: false,
    }

    expect(ALL_WORKFLOW_STEPS.document_integrity.checkDone(ctxEmpty)).toBe(false)
    expect(ALL_WORKFLOW_STEPS.document_integrity.checkAvailable(ctxEmpty)).toBe(true)

    const ctxReady: WorkflowContext = {
      hasDocument: true,
      isParsing: false,
      isIndexed: true,
      chunkCount: 42,
      isFormValid: true,
      hasPlan: true,
      hasReview: true,
      isConfirmed: true,
      hasPlagiarismReport: true,
      hasSupervisorNotes: true,
      hasDefensePrep: true,
      hasCalibrationDiff: true,
      hasFollowupTasks: true,
      savedReviewsCount: 2,
    }

    expect(ALL_WORKFLOW_STEPS.document_integrity.checkDone(ctxReady)).toBe(true)
    expect(ALL_WORKFLOW_STEPS.plagiarism_check.checkDone(ctxReady)).toBe(true)
    expect(ALL_WORKFLOW_STEPS.supervisor_signoff.checkDone(ctxReady)).toBe(true)
    expect(ALL_WORKFLOW_STEPS.defense_prep.checkDone(ctxReady)).toBe(true)
    expect(ALL_WORKFLOW_STEPS.reviewer_calibration.checkDone(ctxReady)).toBe(true)
    expect(ALL_WORKFLOW_STEPS.post_export_followup.checkDone(ctxReady)).toBe(true)
  })

  it("correctly maps legacy step numbers to Step IDs for backward compatibility", () => {
    expect(mapLegacyStepToId(1, 6)).toBe("document_integrity")
    expect(mapLegacyStepToId(2, 6)).toBe("text_understanding")
    expect(mapLegacyStepToId(3, 6)).toBe("plan_and_rubric")
    expect(mapLegacyStepToId(4, 6)).toBe("evidence_analysis")
    expect(mapLegacyStepToId(5, 6)).toBe("draft_review")
    expect(mapLegacyStepToId(6, 6)).toBe("verification_and_export")

    // 4-step legacy mapping
    expect(mapLegacyStepToId(1, 4)).toBe("document_integrity")
    expect(mapLegacyStepToId(2, 4)).toBe("text_understanding")
    expect(mapLegacyStepToId(3, 4)).toBe("evidence_analysis")
    expect(mapLegacyStepToId(4, 4)).toBe("draft_review")
  })
})
