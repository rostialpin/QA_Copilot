# Gemini Model Configuration Guide

## Available Models

QA Copilot now supports the latest Gemini 2.5 models for superior test generation:

### 🚀 Gemini 2.5 Flash (Default)
- **Model ID**: `gemini-2.5-flash`
- **Best for**: Quick test generation, daily use
- **Advantages**:
  - Very fast response times (2-3x faster)
  - Lower cost per request
  - Excellent quality for most test cases
  - Ideal for iterative development
  
### 💎 Gemini 2.5 Pro
- **Model ID**: `gemini-2.5-pro`
- **Best for**: Complex test scenarios, production test suites
- **Advantages**:
  - Highest quality output
  - Better understanding of complex requirements
  - More comprehensive edge case coverage
  - Superior code generation for Cypress tests

## How to Configure

### Option 1: Environment Variable (Recommended)
Add to your `backend/.env` file:

```bash
# For faster, cost-effective generation
GEMINI_MODEL=gemini-2.5-flash

# For highest quality output
GEMINI_MODEL=gemini-2.5-pro
```

### Option 2: Dynamic Selection (Future Enhancement)
We can add a dropdown in the UI to select the model per request.

## Model Comparison

| Feature | Gemini 2.5 Flash | Gemini 2.5 Pro |
|---------|------------------|----------------|
| **Speed** | ⚡⚡⚡ Very Fast | ⚡⚡ Fast |
| **Quality** | ⭐⭐⭐⭐ Great | ⭐⭐⭐⭐⭐ Excellent |
| **Cost** | 💰 Lower | 💰💰 Higher |
| **Test Cases** | 5-10 per request | 10-15 per request |
| **Edge Cases** | Good coverage | Comprehensive |
| **Code Quality** | Clean, functional | Production-ready |

## Use Case Recommendations

### Use Gemini 2.5 Flash when:
- Doing rapid prototyping
- Generating initial test cases
- Working with straightforward features
- Cost optimization is important
- Need quick iterations

### Use Gemini 2.5 Pro when:
- Creating production test suites
- Working with complex business logic
- Need comprehensive edge case coverage
- Generating critical path tests
- Quality is more important than speed

## API Limits

Both models have the following limits:
- **Requests per minute**: 60 (Flash), 30 (Pro)
- **Tokens per request**: 32,768 input, 8,192 output
- **Concurrent requests**: 10 (Flash), 5 (Pro)

## Switching Models

To switch models without restarting:
1. Update the `GEMINI_MODEL` in your `.env` file
2. The next request will use the new model
3. Or restart the server for immediate effect

## Cost Optimization Tips

1. **Start with Flash**: Use Flash for initial generation
2. **Refine with Pro**: Use Pro for critical tests only
3. **Cache Results**: Store generated tests in TestRail
4. **Batch Requests**: Generate multiple test cases in one request

## Troubleshooting

If you see model-related errors:
1. Ensure your API key has access to Gemini 2.5 models
2. Check the model name is spelled correctly
3. Verify your quota hasn't been exceeded
4. Fall back to `gemini-2.5-flash` if Pro isn't available

## Future Enhancements

- [ ] UI model selector
- [ ] Per-project model preferences
- [ ] Automatic model selection based on complexity
- [ ] Model performance metrics dashboard