/**
 * Exam Analytics & SOS Radar
 * Analyzes exam performance and identifies weak points
 */

import { ExamSession, TopicPerformance, WeakPointAnalysis } from '../types';

/**
 * Analyze exam performance and generate weak point analysis
 */
export function analyzeExamPerformance(session: ExamSession): WeakPointAnalysis {
  const topicMap = new Map<string, { correct: number; total: number }>();

  // Group answers by topic
  session.questions.forEach((question, idx) => {
    const topic = question.topic;
    const isCorrect = session.userAnswers[question.id] === question.correctIndex;

    if (!topicMap.has(topic)) {
      topicMap.set(topic, { correct: 0, total: 0 });
    }

    const stats = topicMap.get(topic)!;
    stats.total++;
    if (isCorrect) stats.correct++;
  });

  // Calculate topic breakdown
  const topicBreakdown: TopicPerformance[] = Array.from(topicMap.entries()).map(
    ([topic, stats]) => ({
      topic,
      attempted: stats.total,
      correct: stats.correct,
      percentage: Math.round((stats.correct / stats.total) * 100),
      weakPoints: identifyWeakPoints(topic, session),
    })
  );

  // Sort by performance (worst first)
  topicBreakdown.sort((a, b) => a.percentage - b.percentage);

  const overallScore = session.scores.percentage;
  const weakestTopics = topicBreakdown.slice(0, 3).map((t) => t.topic);
  const strengths = topicBreakdown
    .slice(-2)
    .filter((t) => t.percentage >= 70)
    .map((t) => t.topic);
  const recommendedReview = topicBreakdown
    .filter((t) => t.percentage < 60)
    .flatMap((t) => t.weakPoints);

  return {
    overallScore,
    topicBreakdown,
    weakestTopics,
    recommendedReview: [...new Set(recommendedReview)], // Remove duplicates
    strengths,
  };
}

/**
 * Identify specific weak points within a topic
 */
function identifyWeakPoints(topic: string, session: ExamSession): string[] {
  const weakPoints: string[] = [];

  // Analyze questions in this topic for patterns
  session.questions.forEach((question) => {
    if (question.topic === topic) {
      const isCorrect = session.userAnswers[question.id] === question.correctIndex;
      if (!isCorrect && question.difficulty === 'hard') {
        // Extract weak point from question text (first 20 words)
        const snippet = question.question.substring(0, 60).replace(/[^a-z0-9\s]/gi, '');
        if (snippet) weakPoints.push(snippet);
      }
    }
  });

  return weakPoints.slice(0, 3);
}

/**
 * Calculate performance radar data for visualization
 */
export interface RadarChartData {
  topics: string[];
  performance: number[]; // 0-100
  difficulty: ('easy' | 'medium' | 'hard')[];
}

export function getRadarChartData(analysis: WeakPointAnalysis): RadarChartData {
  return {
    topics: analysis.topicBreakdown.map((t) => t.topic),
    performance: analysis.topicBreakdown.map((t) => t.percentage),
    difficulty: analysis.topicBreakdown.map((t) =>
      t.percentage < 50 ? 'hard' : t.percentage < 75 ? 'medium' : 'easy'
    ),
  };
}

/**
 * Generate study recommendations
 */
export function getStudyRecommendations(analysis: WeakPointAnalysis): string[] {
  const recommendations: string[] = [];

  if (analysis.overallScore < 50) {
    recommendations.push('Θα πρέπει να επαναλάβετε όλη την ύλη από την αρχή');
  } else if (analysis.overallScore < 70) {
    recommendations.push('Εστιάστε στα ασθενή σημεία σας');
  }

  if (analysis.weakestTopics.length > 0) {
    recommendations.push(`Ξαναδιαβάστε: ${analysis.weakestTopics.slice(0, 2).join(', ')}`);
  }

  if (analysis.strengths.length > 0) {
    recommendations.push(`Καλή δουλειά στα: ${analysis.strengths.join(', ')}`);
  }

  recommendations.push('Επαναλάβετε το διαγώνισμα σε 3 ημέρες για να δείτε την πρόοδό σας');

  return recommendations;
}

/**
 * Calculate time spent per question
 */
export function getAverageTimePerQuestion(
  totalTime: number, // minutes
  questionCount: number
): number {
  return Math.round((totalTime * 60) / questionCount); // returns seconds
}
