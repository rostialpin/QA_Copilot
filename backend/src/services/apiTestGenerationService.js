import { logger } from '../utils/logger.js';
import { GeminiService } from './geminiService.js';
import advancedPatternLearningService from './advancedPatternLearningService.js';
import fs from 'fs/promises';
import path from 'path';

/**
 * API Test Generation Service for Rest Assured and other API testing frameworks
 * Generates comprehensive API tests with contract validation, performance testing, and security checks
 */
export class ApiTestGenerationService {
  constructor() {
    this.geminiService = new GeminiService();
    this.frameworks = {
      restAssured: 'java',
      postman: 'javascript',
      pytestRequests: 'python',
      playwright: 'typescript',
      supertest: 'javascript',
      karate: 'feature'
    };
    
    this.testTypes = {
      functional: ['happy-path', 'negative', 'boundary', 'validation'],
      contract: ['schema', 'headers', 'status-codes', 'response-time'],
      security: ['authentication', 'authorization', 'injection', 'rate-limiting'],
      performance: ['load', 'stress', 'spike', 'endurance']
    };
  }

  /**
   * Generate API tests from OpenAPI/Swagger specification
   */
  async generateFromOpenAPI(spec, options = {}) {
    const {
      framework = 'restAssured',
      testTypes = ['functional', 'contract'],
      baseUrl = spec.servers?.[0]?.url || 'http://localhost:8080',
      authentication = null,
      patterns = null
    } = options;

    logger.info(`Generating API tests from OpenAPI spec for ${framework}`);

    const endpoints = this.parseOpenAPIEndpoints(spec);
    const tests = [];

    for (const endpoint of endpoints) {
      const endpointTests = await this.generateEndpointTests(
        endpoint,
        framework,
        testTypes,
        { baseUrl, authentication, patterns }
      );
      tests.push(...endpointTests);
    }

    return this.organizeTestsByFramework(tests, framework);
  }

  /**
   * Parse OpenAPI specification to extract endpoints
   */
  parseOpenAPIEndpoints(spec) {
    const endpoints = [];
    const paths = spec.paths || {};

    for (const [pathStr, pathItem] of Object.entries(paths)) {
      for (const [method, operation] of Object.entries(pathItem)) {
        if (['get', 'post', 'put', 'delete', 'patch'].includes(method)) {
          endpoints.push({
            path: pathStr,
            method: method.toUpperCase(),
            operationId: operation.operationId,
            summary: operation.summary,
            description: operation.description,
            parameters: operation.parameters || [],
            requestBody: operation.requestBody,
            responses: operation.responses,
            security: operation.security || spec.security || [],
            tags: operation.tags || []
          });
        }
      }
    }

    return endpoints;
  }

  /**
   * Generate tests for a specific endpoint
   */
  async generateEndpointTests(endpoint, framework, testTypes, options) {
    const tests = [];

    // Generate functional tests
    if (testTypes.includes('functional')) {
      tests.push(...this.generateFunctionalTests(endpoint, framework, options));
    }

    // Generate contract tests
    if (testTypes.includes('contract')) {
      tests.push(...this.generateContractTests(endpoint, framework, options));
    }

    // Generate security tests
    if (testTypes.includes('security')) {
      tests.push(...this.generateSecurityTests(endpoint, framework, options));
    }

    // Generate performance tests
    if (testTypes.includes('performance')) {
      tests.push(...this.generatePerformanceTests(endpoint, framework, options));
    }

    return tests;
  }

  /**
   * Generate functional API tests
   */
  generateFunctionalTests(endpoint, framework, options) {
    const tests = [];

    // Happy path test
    tests.push(this.generateHappyPathTest(endpoint, framework, options));

    // Negative tests
    if (endpoint.parameters?.length > 0) {
      tests.push(...this.generateNegativeTests(endpoint, framework, options));
    }

    // Boundary tests
    tests.push(...this.generateBoundaryTests(endpoint, framework, options));

    return tests;
  }

  /**
   * Generate happy path test
   */
  generateHappyPathTest(endpoint, framework, options) {
    switch (framework) {
      case 'restAssured':
        return this.generateRestAssuredHappyPath(endpoint, options);
      case 'playwright':
        return this.generatePlaywrightApiTest(endpoint, options);
      case 'postman':
        return this.generatePostmanTest(endpoint, options);
      case 'karate':
        return this.generateKarateFeature(endpoint, options);
      default:
        return this.generateGenericApiTest(endpoint, options);
    }
  }

  /**
   * Generate Rest Assured happy path test
   */
  generateRestAssuredHappyPath(endpoint, options) {
    const { baseUrl, authentication } = options;
    const testName = `test${this.capitalizeOperationId(endpoint.operationId)}HappyPath`;
    
    let authCode = '';
    if (authentication) {
      authCode = this.generateAuthCode(authentication, 'restAssured');
    }

    const successResponse = Object.keys(endpoint.responses)
      .find(code => code.startsWith('2')) || '200';

    const code = `
    @Test
    @DisplayName("${endpoint.summary || endpoint.operationId} - Happy Path")
    public void ${testName}() {
        ${authCode}
        
        Response response = given()
            .baseUri("${baseUrl}")
            ${this.generateRestAssuredHeaders(endpoint)}
            ${this.generateRestAssuredParams(endpoint.parameters)}
            ${this.generateRestAssuredBody(endpoint.requestBody)}
        .when()
            .${endpoint.method.toLowerCase()}("${endpoint.path}")
        .then()
            .statusCode(${successResponse})
            ${this.generateRestAssuredAssertions(endpoint.responses[successResponse])}
            .extract()
            .response();
        
        // Additional validations
        assertThat(response.getTime()).isLessThan(2000L);
        ${this.generateRestAssuredSchemaValidation(endpoint.responses[successResponse])}
    }`;

    return {
      type: 'functional',
      subtype: 'happy-path',
      name: testName,
      code,
      endpoint: endpoint.path,
      method: endpoint.method
    };
  }

  /**
   * Generate negative tests for invalid inputs
   */
  generateNegativeTests(endpoint, framework, options) {
    const tests = [];
    const requiredParams = endpoint.parameters?.filter(p => p.required) || [];

    // Test missing required parameters
    for (const param of requiredParams) {
      tests.push(this.generateMissingParamTest(endpoint, param, framework, options));
    }

    // Test invalid data types
    for (const param of endpoint.parameters || []) {
      if (param.schema?.type) {
        tests.push(this.generateInvalidTypeTest(endpoint, param, framework, options));
      }
    }

    // Test invalid enum values
    for (const param of endpoint.parameters || []) {
      if (param.schema?.enum) {
        tests.push(this.generateInvalidEnumTest(endpoint, param, framework, options));
      }
    }

    return tests;
  }

  /**
   * Generate boundary tests
   */
  generateBoundaryTests(endpoint, framework, options) {
    const tests = [];
    
    for (const param of endpoint.parameters || []) {
      if (param.schema?.type === 'integer' || param.schema?.type === 'number') {
        // Min/Max boundary tests
        if (param.schema.minimum !== undefined) {
          tests.push(this.generateMinBoundaryTest(endpoint, param, framework, options));
        }
        if (param.schema.maximum !== undefined) {
          tests.push(this.generateMaxBoundaryTest(endpoint, param, framework, options));
        }
      } else if (param.schema?.type === 'string') {
        // String length boundary tests
        if (param.schema.minLength !== undefined) {
          tests.push(this.generateMinLengthTest(endpoint, param, framework, options));
        }
        if (param.schema.maxLength !== undefined) {
          tests.push(this.generateMaxLengthTest(endpoint, param, framework, options));
        }
      }
    }

    return tests;
  }

  /**
   * Generate contract validation tests
   */
  generateContractTests(endpoint, framework, options) {
    const tests = [];

    // Schema validation test
    tests.push(this.generateSchemaValidationTest(endpoint, framework, options));

    // Headers validation test
    tests.push(this.generateHeadersValidationTest(endpoint, framework, options));

    // Status code validation
    tests.push(this.generateStatusCodeTest(endpoint, framework, options));

    // Response time validation
    tests.push(this.generateResponseTimeTest(endpoint, framework, options));

    return tests;
  }

  /**
   * Generate security tests
   */
  generateSecurityTests(endpoint, framework, options) {
    const tests = [];

    // Authentication tests
    if (endpoint.security?.length > 0) {
      tests.push(this.generateAuthenticationTest(endpoint, framework, options));
      tests.push(this.generateInvalidAuthTest(endpoint, framework, options));
    }

    // SQL Injection test
    if (endpoint.parameters?.some(p => p.in === 'query' || p.in === 'path')) {
      tests.push(this.generateSQLInjectionTest(endpoint, framework, options));
    }

    // XSS test
    if (endpoint.method === 'POST' || endpoint.method === 'PUT') {
      tests.push(this.generateXSSTest(endpoint, framework, options));
    }

    // Rate limiting test
    tests.push(this.generateRateLimitTest(endpoint, framework, options));

    return tests;
  }

  /**
   * Generate performance tests
   */
  generatePerformanceTests(endpoint, framework, options) {
    const tests = [];

    // Load test
    tests.push(this.generateLoadTest(endpoint, framework, options));

    // Stress test
    tests.push(this.generateStressTest(endpoint, framework, options));

    // Spike test
    tests.push(this.generateSpikeTest(endpoint, framework, options));

    return tests;
  }

  /**
   * Generate Playwright API test
   */
  generatePlaywrightApiTest(endpoint, options) {
    const { baseUrl } = options;
    const testName = `should ${endpoint.method.toLowerCase()} ${endpoint.path} successfully`;

    const code = `
  test('${testName}', async ({ request }) => {
    const response = await request.${endpoint.method.toLowerCase()}(\`${baseUrl}${endpoint.path}\`, {
      ${this.generatePlaywrightOptions(endpoint)}
    });

    expect(response.ok()).toBeTruthy();
    expect(response.status()).toBe(${this.getSuccessCode(endpoint)});

    const data = await response.json();
    ${this.generatePlaywrightAssertions(endpoint)}

    // Response time check
    const responseTime = response.headers()['x-response-time'];
    if (responseTime) {
      expect(parseInt(responseTime)).toBeLessThan(2000);
    }
  });`;

    return {
      type: 'functional',
      subtype: 'happy-path',
      name: testName,
      code,
      endpoint: endpoint.path,
      method: endpoint.method
    };
  }

  /**
   * Generate Karate feature file
   */
  generateKarateFeature(endpoint, options) {
    const { baseUrl } = options;
    const feature = `
Feature: ${endpoint.tags?.[0] || 'API'} - ${endpoint.operationId}

  Background:
    * url '${baseUrl}'
    ${this.generateKarateAuth(options.authentication)}

  Scenario: ${endpoint.summary || endpoint.operationId} - Happy Path
    Given path '${endpoint.path}'
    ${this.generateKarateParams(endpoint.parameters)}
    ${this.generateKarateBody(endpoint.requestBody)}
    When method ${endpoint.method.toLowerCase()}
    Then status ${this.getSuccessCode(endpoint)}
    ${this.generateKarateAssertions(endpoint)}
    And match responseTime < 2000
`;

    return {
      type: 'functional',
      subtype: 'happy-path',
      name: `${endpoint.operationId}.feature`,
      code: feature,
      endpoint: endpoint.path,
      method: endpoint.method,
      fileType: 'feature'
    };
  }

  /**
   * Generate schema validation test
   */
  generateSchemaValidationTest(endpoint, framework, options) {
    const successResponse = this.getSuccessResponse(endpoint);
    
    if (framework === 'restAssured') {
      const code = `
    @Test
    @DisplayName("${endpoint.operationId} - Schema Validation")
    public void test${this.capitalizeOperationId(endpoint.operationId)}SchemaValidation() {
        given()
            .baseUri("${options.baseUrl}")
            ${this.generateValidParams(endpoint)}
        .when()
            .${endpoint.method.toLowerCase()}("${endpoint.path}")
        .then()
            .statusCode(${this.getSuccessCode(endpoint)})
            .body(matchesJsonSchemaInClasspath("schemas/${endpoint.operationId}-response.json"));
    }`;

      return {
        type: 'contract',
        subtype: 'schema',
        name: `test${this.capitalizeOperationId(endpoint.operationId)}SchemaValidation`,
        code,
        endpoint: endpoint.path,
        method: endpoint.method
      };
    }

    // Playwright version
    const code = `
  test('${endpoint.operationId} - Schema Validation', async ({ request }) => {
    const response = await request.${endpoint.method.toLowerCase()}(\`${options.baseUrl}${endpoint.path}\`, {
      ${this.generatePlaywrightOptions(endpoint)}
    });

    const data = await response.json();
    const ajv = new Ajv();
    const validate = ajv.compile(${endpoint.operationId}Schema);
    const valid = validate(data);
    
    expect(valid).toBeTruthy();
    if (!valid) {
      console.error('Schema validation errors:', validate.errors);
    }
  });`;

    return {
      type: 'contract',
      subtype: 'schema',
      name: `${endpoint.operationId} - Schema Validation`,
      code,
      endpoint: endpoint.path,
      method: endpoint.method
    };
  }

  /**
   * Generate SQL injection test
   */
  generateSQLInjectionTest(endpoint, framework, options) {
    const injectionPayloads = [
      "' OR '1'='1",
      "'; DROP TABLE users; --",
      "1' UNION SELECT * FROM users--",
      "<script>alert('XSS')</script>"
    ];

    if (framework === 'restAssured') {
      const code = `
    @Test
    @DisplayName("${endpoint.operationId} - SQL Injection Protection")
    public void test${this.capitalizeOperationId(endpoint.operationId)}SQLInjection() {
        String[] injectionPayloads = {
            "' OR '1'='1",
            "'; DROP TABLE users; --",
            "1' UNION SELECT * FROM users--"
        };

        for (String payload : injectionPayloads) {
            given()
                .baseUri("${options.baseUrl}")
                .queryParam("id", payload)
            .when()
                .${endpoint.method.toLowerCase()}("${endpoint.path}")
            .then()
                .statusCode(anyOf(is(400), is(422), is(403)))
                .body(not(containsString("SQL")))
                .body(not(containsString("syntax")));
        }
    }`;

      return {
        type: 'security',
        subtype: 'injection',
        name: `test${this.capitalizeOperationId(endpoint.operationId)}SQLInjection`,
        code,
        endpoint: endpoint.path,
        method: endpoint.method
      };
    }

    return null;
  }

  /**
   * Generate rate limiting test
   */
  generateRateLimitTest(endpoint, framework, options) {
    if (framework === 'restAssured') {
      const code = `
    @Test
    @DisplayName("${endpoint.operationId} - Rate Limiting")
    public void test${this.capitalizeOperationId(endpoint.operationId)}RateLimiting() {
        int requestCount = 100;
        int expectedLimit = 60; // 60 requests per minute
        
        List<Response> responses = new ArrayList<>();
        
        for (int i = 0; i < requestCount; i++) {
            Response response = given()
                .baseUri("${options.baseUrl}")
            .when()
                .${endpoint.method.toLowerCase()}("${endpoint.path}")
            .then()
                .extract()
                .response();
            
            responses.add(response);
            
            if (response.statusCode() == 429) {
                // Rate limit reached
                assertThat(i).isGreaterThanOrEqualTo(expectedLimit - 5); // Allow some variance
                break;
            }
        }
        
        // Verify rate limit headers
        Response lastResponse = responses.get(responses.size() - 1);
        assertThat(lastResponse.header("X-RateLimit-Limit")).isNotNull();
        assertThat(lastResponse.header("X-RateLimit-Remaining")).isNotNull();
    }`;

      return {
        type: 'security',
        subtype: 'rate-limiting',
        name: `test${this.capitalizeOperationId(endpoint.operationId)}RateLimiting`,
        code,
        endpoint: endpoint.path,
        method: endpoint.method
      };
    }

    return null;
  }

  /**
   * Generate load test using JMeter DSL or k6
   */
  generateLoadTest(endpoint, framework, options) {
    const code = `
import us.abstracta.jmeter.javadsl.core.TestPlanStats;
import static us.abstracta.jmeter.javadsl.JmeterDsl.*;

@Test
@DisplayName("${endpoint.operationId} - Load Test")
public void test${this.capitalizeOperationId(endpoint.operationId)}LoadTest() throws Exception {
    TestPlanStats stats = testPlan(
        threadGroup(100, 10, // 100 users, 10 iterations each
            httpSampler("${options.baseUrl}${endpoint.path}")
                .method(HTTPConstants.${endpoint.method})
                ${this.generateJMeterHeaders(endpoint)}
                ${this.generateJMeterBody(endpoint.requestBody)}
        ),
        htmlReporter("target/jmeter-reports/${endpoint.operationId}")
    ).run();
    
    assertThat(stats.overall().sampleTimePercentile99()).isLessThan(Duration.ofSeconds(3));
    assertThat(stats.overall().errorCount()).isEqualTo(0);
    assertThat(stats.overall().meanResponseTime()).isLessThan(Duration.ofSeconds(1));
}`;

    return {
      type: 'performance',
      subtype: 'load',
      name: `test${this.capitalizeOperationId(endpoint.operationId)}LoadTest`,
      code,
      endpoint: endpoint.path,
      method: endpoint.method
    };
  }

  /**
   * Helper methods for code generation
   */
  capitalizeOperationId(operationId) {
    if (!operationId) return 'Unknown';
    return operationId.charAt(0).toUpperCase() + operationId.slice(1);
  }

  getSuccessCode(endpoint) {
    return Object.keys(endpoint.responses || {})
      .find(code => code.startsWith('2')) || '200';
  }

  getSuccessResponse(endpoint) {
    const successCode = this.getSuccessCode(endpoint);
    return endpoint.responses?.[successCode];
  }

  generateRestAssuredHeaders(endpoint) {
    const headers = [];
    
    if (endpoint.requestBody?.content?.['application/json']) {
      headers.push('.contentType(ContentType.JSON)');
    }
    
    if (endpoint.parameters) {
      const headerParams = endpoint.parameters.filter(p => p.in === 'header');
      for (const param of headerParams) {
        if (param.example) {
          headers.push(`.header("${param.name}", "${param.example}")`);
        }
      }
    }
    
    return headers.join('\n            ');
  }

  generateRestAssuredParams(parameters) {
    if (!parameters) return '';
    
    const params = [];
    
    // Query parameters
    const queryParams = parameters.filter(p => p.in === 'query');
    for (const param of queryParams) {
      if (param.example !== undefined) {
        params.push(`.queryParam("${param.name}", "${param.example}")`);
      }
    }
    
    // Path parameters
    const pathParams = parameters.filter(p => p.in === 'path');
    for (const param of pathParams) {
      if (param.example !== undefined) {
        params.push(`.pathParam("${param.name}", "${param.example}")`);
      }
    }
    
    return params.join('\n            ');
  }

  generateRestAssuredBody(requestBody) {
    if (!requestBody) return '';
    
    if (requestBody.content?.['application/json']?.example) {
      const example = JSON.stringify(requestBody.content['application/json'].example, null, 4);
      return `.body("""
                ${example}
                """)`;
    }
    
    return '';
  }

  generateRestAssuredAssertions(response) {
    const assertions = [];
    
    if (response?.content?.['application/json']?.schema?.properties) {
      const properties = response.content['application/json'].schema.properties;
      for (const [key, schema] of Object.entries(properties)) {
        if (schema.type === 'string') {
          assertions.push(`.body("${key}", notNullValue())`);
        } else if (schema.type === 'number' || schema.type === 'integer') {
          assertions.push(`.body("${key}", greaterThanOrEqualTo(0))`);
        } else if (schema.type === 'array') {
          assertions.push(`.body("${key}", hasSize(greaterThan(0)))`);
        }
      }
    }
    
    return assertions.slice(0, 3).join('\n            ');
  }

  generateRestAssuredSchemaValidation(response) {
    if (response?.content?.['application/json']?.schema) {
      return `
        JsonSchemaValidator.matchesJsonSchema(
            getClass().getResourceAsStream("/schemas/response-schema.json")
        );`;
    }
    return '';
  }

  generatePlaywrightOptions(endpoint) {
    const options = [];
    
    if (endpoint.parameters) {
      const queryParams = endpoint.parameters
        .filter(p => p.in === 'query' && p.example)
        .reduce((acc, p) => {
          acc[p.name] = p.example;
          return acc;
        }, {});
      
      if (Object.keys(queryParams).length > 0) {
        options.push(`params: ${JSON.stringify(queryParams)}`);
      }
    }
    
    if (endpoint.requestBody?.content?.['application/json']?.example) {
      options.push(`data: ${JSON.stringify(endpoint.requestBody.content['application/json'].example)}`);
    }
    
    return options.join(',\n      ');
  }

  generatePlaywrightAssertions(endpoint) {
    const response = this.getSuccessResponse(endpoint);
    const assertions = [];
    
    if (response?.content?.['application/json']?.schema?.properties) {
      const properties = response.content['application/json'].schema.properties;
      for (const [key, schema] of Object.entries(properties)) {
        if (schema.type === 'string') {
          assertions.push(`expect(data.${key}).toBeTruthy();`);
        } else if (schema.type === 'array') {
          assertions.push(`expect(Array.isArray(data.${key})).toBeTruthy();`);
        }
      }
    }
    
    return assertions.slice(0, 3).join('\n    ');
  }

  generateValidParams(endpoint) {
    // Generate valid parameters for contract testing
    return this.generateRestAssuredParams(endpoint.parameters);
  }

  generateAuthCode(authentication, framework) {
    if (framework === 'restAssured') {
      if (authentication.type === 'bearer') {
        return `.header("Authorization", "Bearer " + getAccessToken())`;
      } else if (authentication.type === 'basic') {
        return `.auth().basic(username, password)`;
      } else if (authentication.type === 'apiKey') {
        return `.header("${authentication.header}", apiKey)`;
      }
    }
    return '';
  }

  generateKarateAuth(authentication) {
    if (!authentication) return '';
    
    if (authentication.type === 'bearer') {
      return "* header Authorization = 'Bearer ' + token";
    } else if (authentication.type === 'basic') {
      return "* header Authorization = call read('classpath:auth/basic-auth.js')";
    }
    
    return '';
  }

  generateKarateParams(parameters) {
    if (!parameters) return '';
    
    const lines = [];
    for (const param of parameters) {
      if (param.in === 'query' && param.example) {
        lines.push(`And param ${param.name} = '${param.example}'`);
      }
    }
    
    return lines.join('\n    ');
  }

  generateKarateBody(requestBody) {
    if (!requestBody?.content?.['application/json']?.example) return '';
    
    return `And request ${JSON.stringify(requestBody.content['application/json'].example)}`;
  }

  generateKarateAssertions(endpoint) {
    const response = this.getSuccessResponse(endpoint);
    const assertions = [];
    
    if (response?.content?.['application/json']?.schema?.properties) {
      assertions.push("And match response != null");
      assertions.push("And match response contains { id: '#notnull' }");
    }
    
    return assertions.join('\n    ');
  }

  /**
   * Generate missing parameter test
   */
  generateMissingParamTest(endpoint, param, framework, options) {
    if (framework === 'restAssured') {
      const code = `
    @Test
    @DisplayName("${endpoint.operationId} - Missing ${param.name}")
    public void test${this.capitalizeOperationId(endpoint.operationId)}Missing${this.capitalize(param.name)}() {
        given()
            .baseUri("${options.baseUrl}")
            // Omitting required parameter: ${param.name}
        .when()
            .${endpoint.method.toLowerCase()}("${endpoint.path}")
        .then()
            .statusCode(400)
            .body("error", containsString("${param.name}"))
            .body("error", containsString("required"));
    }`;

      return {
        type: 'functional',
        subtype: 'negative',
        name: `test${this.capitalizeOperationId(endpoint.operationId)}Missing${this.capitalize(param.name)}`,
        code,
        endpoint: endpoint.path,
        method: endpoint.method
      };
    }
    
    return null;
  }

  /**
   * Generate invalid type test
   */
  generateInvalidTypeTest(endpoint, param, framework, options) {
    const invalidValue = this.getInvalidValueForType(param.schema.type);
    
    if (framework === 'restAssured') {
      const code = `
    @Test
    @DisplayName("${endpoint.operationId} - Invalid ${param.name} Type")
    public void test${this.capitalizeOperationId(endpoint.operationId)}Invalid${this.capitalize(param.name)}Type() {
        given()
            .baseUri("${options.baseUrl}")
            .queryParam("${param.name}", "${invalidValue}")
        .when()
            .${endpoint.method.toLowerCase()}("${endpoint.path}")
        .then()
            .statusCode(400)
            .body("error", containsString("${param.name}"))
            .body("error", containsString("invalid"));
    }`;

      return {
        type: 'functional',
        subtype: 'negative',
        name: `test${this.capitalizeOperationId(endpoint.operationId)}Invalid${this.capitalize(param.name)}Type`,
        code,
        endpoint: endpoint.path,
        method: endpoint.method
      };
    }
    
    return null;
  }

  getInvalidValueForType(type) {
    switch (type) {
      case 'integer':
      case 'number':
        return 'not-a-number';
      case 'boolean':
        return 'not-a-boolean';
      case 'array':
        return 'not-an-array';
      default:
        return '!@#$%^&*()';
    }
  }

  capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  /**
   * Organize tests by framework structure
   */
  organizeTestsByFramework(tests, framework) {
    const organized = {
      framework,
      testFiles: [],
      totalTests: tests.length,
      byType: {},
      byEndpoint: {}
    };

    // Group by test type
    for (const test of tests) {
      if (!organized.byType[test.type]) {
        organized.byType[test.type] = [];
      }
      organized.byType[test.type].push(test);

      // Group by endpoint
      const endpointKey = `${test.method} ${test.endpoint}`;
      if (!organized.byEndpoint[endpointKey]) {
        organized.byEndpoint[endpointKey] = [];
      }
      organized.byEndpoint[endpointKey].push(test);
    }

    // Create test files structure
    if (framework === 'restAssured') {
      organized.testFiles = this.createRestAssuredFileStructure(tests);
    } else if (framework === 'playwright') {
      organized.testFiles = this.createPlaywrightFileStructure(tests);
    } else if (framework === 'karate') {
      organized.testFiles = this.createKarateFileStructure(tests);
    }

    return organized;
  }

  /**
   * Create Rest Assured file structure
   */
  createRestAssuredFileStructure(tests) {
    const files = [];
    const testsByEndpoint = {};

    for (const test of tests) {
      const key = test.endpoint.replace(/[{}]/g, '').replace(/\//g, '_');
      if (!testsByEndpoint[key]) {
        testsByEndpoint[key] = [];
      }
      testsByEndpoint[key].push(test);
    }

    for (const [endpoint, endpointTests] of Object.entries(testsByEndpoint)) {
      const className = `${this.capitalize(endpoint)}ApiTest`;
      const imports = this.generateRestAssuredImports(endpointTests);
      const classContent = `
${imports}

public class ${className} extends BaseApiTest {
    
    ${endpointTests.map(t => t.code).join('\n\n    ')}
}`;

      files.push({
        filename: `${className}.java`,
        path: `src/test/java/api/${className}.java`,
        content: classContent,
        testCount: endpointTests.length
      });
    }

    return files;
  }

  /**
   * Generate Rest Assured imports
   */
  generateRestAssuredImports(tests) {
    const imports = new Set([
      'import io.restassured.RestAssured;',
      'import io.restassured.response.Response;',
      'import io.restassured.http.ContentType;',
      'import org.junit.jupiter.api.Test;',
      'import org.junit.jupiter.api.DisplayName;',
      'import static io.restassured.RestAssured.*;',
      'import static org.hamcrest.Matchers.*;',
      'import static org.assertj.core.api.Assertions.*;'
    ]);

    // Add specific imports based on test types
    for (const test of tests) {
      if (test.type === 'contract') {
        imports.add('import io.restassured.module.jsv.JsonSchemaValidator;');
      }
      if (test.type === 'performance') {
        imports.add('import us.abstracta.jmeter.javadsl.core.TestPlanStats;');
        imports.add('import static us.abstracta.jmeter.javadsl.JmeterDsl.*;');
      }
    }

    return Array.from(imports).join('\n');
  }

  /**
   * Create Playwright file structure
   */
  createPlaywrightFileStructure(tests) {
    const files = [];
    const testsByType = {};

    for (const test of tests) {
      if (!testsByType[test.type]) {
        testsByType[test.type] = [];
      }
      testsByType[test.type].push(test);
    }

    for (const [type, typeTests] of Object.entries(testsByType)) {
      const filename = `${type}.spec.ts`;
      const content = `
import { test, expect } from '@playwright/test';
import { APIRequestContext } from '@playwright/test';
${type === 'contract' ? "import Ajv from 'ajv';" : ''}

test.describe('${this.capitalize(type)} API Tests', () => {
  ${typeTests.map(t => t.code).join('\n\n  ')}
});`;

      files.push({
        filename,
        path: `tests/api/${filename}`,
        content,
        testCount: typeTests.length
      });
    }

    return files;
  }

  /**
   * Create Karate file structure
   */
  createKarateFileStructure(tests) {
    return tests
      .filter(t => t.fileType === 'feature')
      .map(test => ({
        filename: test.name,
        path: `src/test/java/features/${test.name}`,
        content: test.code,
        testCount: 1
      }));
  }

  /**
   * Generate tests from manual test cases
   */
  async generateFromManualTests(manualTests, options = {}) {
    const { framework = 'restAssured' } = options;
    const apiTests = [];

    for (const manualTest of manualTests) {
      const apiEndpoints = this.extractApiEndpoints(manualTest);
      
      for (const endpoint of apiEndpoints) {
        const test = await this.convertManualToApiTest(
          manualTest,
          endpoint,
          framework,
          options
        );
        apiTests.push(test);
      }
    }

    return this.organizeTestsByFramework(apiTests, framework);
  }

  /**
   * Extract API endpoints from manual test steps
   */
  extractApiEndpoints(manualTest) {
    const endpoints = [];
    const apiPatterns = [
      /(?:GET|POST|PUT|DELETE|PATCH)\s+([\/\w\-{}]+)/gi,
      /api[\/\w\-{}]+/gi,
      /endpoint[:\s]+([\/\w\-{}]+)/gi
    ];

    for (const step of manualTest.steps || []) {
      const stepText = step.action + ' ' + (step.expected || '');
      
      for (const pattern of apiPatterns) {
        const matches = stepText.matchAll(pattern);
        for (const match of matches) {
          endpoints.push({
            path: match[1] || match[0],
            method: match[0].split(' ')[0] || 'GET',
            description: step.action
          });
        }
      }
    }

    return endpoints;
  }

  /**
   * Convert manual test to API test
   */
  async convertManualToApiTest(manualTest, endpoint, framework, options) {
    const prompt = `
Convert this manual test step to an automated API test:
Manual Test: ${manualTest.title}
Step: ${endpoint.description}
Endpoint: ${endpoint.method} ${endpoint.path}
Framework: ${framework}

Generate a complete test that validates:
- Status code
- Response structure
- Business logic assertions
- Error handling
`;

    const aiGenerated = await this.geminiService.generateContent(prompt);
    
    // Fallback to template-based generation if AI fails
    if (!aiGenerated) {
      return this.generateTemplateBasedApiTest(manualTest, endpoint, framework, options);
    }

    return {
      type: 'functional',
      subtype: 'converted',
      name: `test_${manualTest.title.replace(/\s+/g, '_')}`,
      code: aiGenerated,
      endpoint: endpoint.path,
      method: endpoint.method,
      source: 'manual-conversion'
    };
  }

  /**
   * Generate template-based API test
   */
  generateTemplateBasedApiTest(manualTest, endpoint, framework, options) {
    if (framework === 'restAssured') {
      const code = `
    @Test
    @DisplayName("${manualTest.title}")
    public void test${this.sanitizeMethodName(manualTest.title)}() {
        // ${manualTest.objective}
        
        Response response = given()
            .baseUri("${options.baseUrl || 'http://localhost:8080'}")
        .when()
            .${endpoint.method.toLowerCase()}("${endpoint.path}")
        .then()
            .statusCode(200)
            .extract()
            .response();
        
        // Validate: ${manualTest.expectedResult}
        assertThat(response.getBody()).isNotNull();
    }`;

      return {
        type: 'functional',
        subtype: 'converted',
        name: `test${this.sanitizeMethodName(manualTest.title)}`,
        code,
        endpoint: endpoint.path,
        method: endpoint.method,
        source: 'template'
      };
    }

    return null;
  }

  sanitizeMethodName(title) {
    return title
      .replace(/[^a-zA-Z0-9]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
  }
}

export default new ApiTestGenerationService();