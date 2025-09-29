const fetchMock = require('jest-fetch-mock');

fetchMock.enableMocks();

beforeEach(() => {
  fetchMock.resetMocks();
});
