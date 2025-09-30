const fs = require('fs');
const path = require('path');

class TestSummaryReporter {
  constructor(globalConfig, options = {}) {
    this.output = options.output || path.join(process.cwd(), 'logs', 'test-report.json');
  }

  onRunComplete(contexts, results) {
    const computedSuccess =
      results.numFailedTests === 0 &&
      results.numFailedTestSuites === 0 &&
      results.numRuntimeErrorTestSuites === 0;
    const summary = {
      success: computedSuccess,
      runnerSuccess: results.success,
      startTime: new Date(results.startTime).toISOString(),
      endTime: new Date().toISOString(),
      numTotalTests: results.numTotalTests,
      numPassedTests: results.numPassedTests,
      numFailedTests: results.numFailedTests,
      numPendingTests: results.numPendingTests,
      numTodoTests: results.numTodoTests,
      numTotalTestSuites: results.numTotalTestSuites,
      numPassedTestSuites: results.numPassedTestSuites,
      numFailedTestSuites: results.numFailedTestSuites,
      numRuntimeErrorTestSuites: results.numRuntimeErrorTestSuites,
      coverageMap: results.coverageMap ? 'generated' : null,
      testResults: results.testResults.map((suite) => ({
        path: path.relative(process.cwd(), suite.testFilePath),
        status: suite.status,
        assertionResults: suite.testResults.map((assertion) => ({
          title: assertion.fullName,
          status: assertion.status,
          duration: assertion.duration ?? null,
        })),
      })),
    };

    const outputPath = path.isAbsolute(this.output)
      ? this.output
      : path.join(process.cwd(), this.output);

    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify(summary, null, 2));
  }
}

module.exports = TestSummaryReporter;
