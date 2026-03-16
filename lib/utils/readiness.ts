/**
 * Calculates the overall readiness score as a weighted average of three dimensions.
 * Weights: curriculum 33%, quiz 34%, hours 33%.
 */
export function calculateOverallScore(
  curriculumScore: number,
  quizScore: number,
  hoursScore: number
): number {
  const overall =
    curriculumScore * 0.33 + quizScore * 0.34 + hoursScore * 0.33;
  return Math.round(overall * 10) / 10;
}
