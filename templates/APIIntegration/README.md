# API Integration Template

A production-ready FlowLang template for integrating with external REST APIs. This template demonstrates best practices for API calls including authentication, retry logic, error handling, and response transformation.

## Features

- ✅ **Input validation** - Validate API parameters before making requests
- ✅ **Authentication handling** - Support for various auth methods (API keys, Bearer tokens, etc.)
- ✅ **Request building** - Construct complete requests with headers, params, and body
- ✅ **Retry logic** - Exponential backoff for transient failures
- ✅ **Error handling** - Graceful handling of API errors with smart retry decisions
- ✅ **Response parsing** - Extract and transform API responses
- ✅ **Logging** - Track API calls for monitoring and debugging
- ✅ **Timeout support** - Prevent hanging on slow APIs

## Template Variables

When creating a flow from this template, you'll need to provide values for these placeholders:

| Variable | Description | Example |
|----------|-------------|---------|
| `{{FLOW_NAME}}` | Name of your flow | `GitHubAPI`, `StripePayments` |
| `{{FLOW_DESCRIPTION}}` | Brief description | `Integrate with GitHub REST API` |
| `{{API_BASE_URL}}` | Base URL of the API | `https://api.github.com` |
| `{{API_KEY_ENV_VAR}}` | Environment variable for API key | `GITHUB_TOKEN`, `STRIPE_API_KEY` |
| `{{AUTH_HEADER_NAME}}` | Authentication header name | `Authorization`, `X-API-Key` |
| `{{AUTH_HEADER_PREFIX}}` | Prefix for auth value | `Bearer `, `token ` |

## Quick Start

### 1. Create a flow from this template

```bash
# Using FlowLang CLI
flowlang new MyAPIFlow --template APIIntegration

# You'll be prompted for template variables:
# Flow name: MyAPIFlow
# Description: Integrate with MyAPI service
# API base URL: https://api.example.com
# API key env var: MYAPI_KEY
# Auth header name: Authorization
# Auth header prefix: Bearer
```

### 2. Set up authentication

Export your API key as an environment variable:

```bash
export MYAPI_KEY="your-api-key-here"
```

Or create a `.env` file in your project directory:

```bash
MYAPI_KEY=your-api-key-here
```

### 3. Customize task implementations

The template generates working stubs, but you'll want to customize:

#### `CallAPI` task (flow.py:164)
Replace the stub with actual HTTP calls using your preferred library:

```python
import httpx

@registry.register('CallAPI')
async def call_api(url, method, headers, body, timeout):
    start_time = time.time()
    try:
        async with httpx.AsyncClient() as client:
            response = await client.request(
                method=method,
                url=url,
                headers=headers,
                json=body,
                timeout=timeout
            )
            duration = time.time() - start_time

            return {
                'status_code': response.status_code,
                'response_body': response.json() if response.text else {},
                'response_headers': dict(response.headers),
                'success': response.status_code < 400,
                'error': None if response.status_code < 400 else response.text,
                'duration': duration
            }
    except Exception as e:
        duration = time.time() - start_time
        return {
            'status_code': 0,
            'response_body': {},
            'response_headers': {},
            'success': False,
            'error': str(e),
            'duration': duration
        }
```

#### `ParseResponse` task (flow.py:298)
Customize to match your API's response format:

```python
@registry.register('ParseResponse')
async def parse_response(response_body, response_headers, status_code):
    # Example: GitHub API returns data directly
    data = response_body

    # Example: Some APIs wrap data
    # data = response_body.get('data', {})

    # Example: Paginated responses
    # data = response_body.get('results', [])

    metadata = {
        'status_code': status_code,
        'rate_limit_remaining': response_headers.get('x-ratelimit-remaining'),
        'rate_limit_reset': response_headers.get('x-ratelimit-reset'),
        'timestamp': time.time()
    }

    return {'data': data, 'metadata': metadata}
```

#### `TransformResponse` task (flow.py:333)
Transform API responses to your desired format:

```python
@registry.register('TransformResponse')
async def transform_response(data, metadata):
    # Example: Extract specific fields
    result = {
        'id': data.get('id'),
        'name': data.get('full_name'),
        'stars': data.get('stargazers_count'),
        'url': data.get('html_url')
    }

    return {'result': result}
```

### 4. Start the server

```bash
cd MyAPIFlow
./tools/start_server.sh --reload
```

### 5. Test the API

```bash
# Example: Get a GitHub repository
curl -X POST http://localhost:8000/flows/MyAPIFlow/execute \
  -H "Content-Type: application/json" \
  -d '{
    "inputs": {
      "endpoint": "/repos/octocat/Hello-World",
      "method": "GET"
    }
  }'
```

## Flow Structure

The template implements a robust API integration pattern:

```
1. ValidateInputs         → Validate request parameters
2. GetAuthCredentials     → Retrieve API authentication
3. BuildRequest           → Construct complete request
4. CallAPI                → Execute HTTP request (with retry)
   ├─ on_error: LogAPIError
5. HandleAPIError         → Analyze errors (if failed)
6. ParseResponse          → Extract data from response
7. TransformResponse      → Transform to desired format
8. LogAPISuccess          → Log successful call
```

### Error Handling

The template includes smart error handling:

- **Validation errors** → Fail fast before making requests
- **Auth errors (401/403)** → Don't retry, raise immediately
- **Rate limits (429)** → Retry with backoff
- **Server errors (5xx)** → Retry with exponential backoff
- **Client errors (4xx)** → Don't retry, raise error
- **Network errors** → Retry with backoff

### Retry Configuration

The template uses exponential backoff for resilience:

```yaml
retry:
  max_attempts: 3
  delay_seconds: 2
  backoff_multiplier: 2.0
```

This means:
- Attempt 1: Immediate
- Attempt 2: 2 seconds delay
- Attempt 3: 4 seconds delay

## Common Customizations

### Different Authentication Methods

#### API Key in header
```python
auth_header = {"X-API-Key": api_key}
```

#### Bearer token
```python
auth_header = {"Authorization": f"Bearer {api_key}"}
```

#### Basic auth
```python
import base64
credentials = base64.b64encode(f"{username}:{password}".encode()).decode()
auth_header = {"Authorization": f"Basic {credentials}"}
```

#### OAuth
```python
# Get access token first
access_token = await get_oauth_token(client_id, client_secret)
auth_header = {"Authorization": f"Bearer {access_token}"}
```

### Rate Limiting

Add rate limit handling in `HandleAPIError`:

```python
if status_code == 429:
    # Check Retry-After header
    retry_after = response_headers.get('retry-after', 60)
    error_message = f"Rate limited. Retry after {retry_after}s"
    should_retry = True
```

### Pagination

Add pagination support by creating a loop in the flow:

```yaml
steps:
  - task: CallAPI
    id: initial_call
    # ... config ...

  - for_each: ${initial_call.response_body.next_pages}
    as: page_url
    do:
      - task: CallAPI
        inputs:
          url: ${page_url}
```

## Best Practices

1. **Always validate inputs** - Fail fast on bad data
2. **Use environment variables** - Never hardcode credentials
3. **Log strategically** - Log errors always, successes in production
4. **Handle rate limits** - Check for 429 responses and respect Retry-After
5. **Set reasonable timeouts** - Prevent hanging on slow APIs
6. **Transform responses** - Return only what you need
7. **Test error cases** - Simulate failures to verify retry logic

## Dependencies

Add these to your `requirements.txt`:

```
flowlang>=0.1.0
httpx>=0.24.0        # or aiohttp, requests
python-dotenv>=1.0.0 # for .env file support
```

## Testing

The template includes test stubs. Customize them for your API:

```python
# tests/test_tasks.py
import pytest
from flow import registry

@pytest.mark.asyncio
async def test_call_api_success():
    """Test successful API call"""
    result = await registry.get_task('CallAPI')(
        url='https://api.example.com/endpoint',
        method='GET',
        headers={},
        body=None,
        timeout=30
    )

    assert result['success'] is True
    assert result['status_code'] == 200

@pytest.mark.asyncio
async def test_handle_api_error_retry_logic():
    """Test retry logic for different status codes"""
    # 5xx should retry
    result = await registry.get_task('HandleAPIError')(
        status_code=503,
        error='Service unavailable',
        response={}
    )
    assert result['should_retry'] is True

    # 4xx should not retry
    result = await registry.get_task('HandleAPIError')(
        status_code=404,
        error='Not found',
        response={}
    )
    assert result['should_retry'] is False
```

## Troubleshooting

### "Authentication failed" errors
- Check that your API key environment variable is set
- Verify the auth header format matches your API's requirements
- Check if your API key has necessary permissions

### Timeout errors
- Increase the timeout value in the CallAPI task
- Check your network connection
- Verify the API endpoint is accessible

### Rate limit errors
- Add delays between requests
- Implement request queuing
- Check your API plan's rate limits

## Examples

See the `examples/` directory for complete examples:
- `github_api/` - GitHub API integration
- `stripe_api/` - Stripe payments integration
- `weather_api/` - Weather data API
- `slack_api/` - Slack notifications

## Contributing

Found a bug or have a suggestion? Open an issue or submit a PR!

## License

This template is part of FlowLang and is available under the same license.
