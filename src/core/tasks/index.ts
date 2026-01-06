/**
 * Tasks Module Index
 *
 * Central export point for task type definitions and generation.
 * Implements Gap 4.6: Traditional Task Type Library.
 */

// Traditional Task Types
export {
  type TaskCategory,
  type TraditionalTaskType,
  type CognitiveProcess,
  type ResponseFormat,
  type TraditionalTaskTypeMeta,
  TRADITIONAL_TASK_TYPES,
  getTaskTypesByCategory,
  getTaskTypesForStage,
  getTaskTypesForIntent,
  getTaskTypesForComponent,
  getProductiveTaskTypes,
  getReceptiveTaskTypes,
  calculateTaskSuitability,
  selectOptimalTaskType,
  // z(w) vector task selection (Gap 2.2)
  getTasksForFeatureVector,
  selectOptimalTaskTypeWithFeatureVector,
} from './traditional-task-types';

// Task Constraint Solver
export {
  type ObjectSelectionConstraints,
  type ScoredObject,
  type SelectionResult,
  type CollocationPair,
  TaskConstraintSolver,
  createConstraintSolver,
  selectObjectsForTask,
} from './task-constraint-solver';

// Distractor Generator
export {
  type DistractorStrategy,
  type Distractor,
  type DistractorConfig,
  type DistractorSet,
  DistractorGenerator,
  createDistractorGenerator,
  generateDistractors,
} from './distractor-generator';
