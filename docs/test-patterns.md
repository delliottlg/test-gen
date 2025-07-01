# Test Generation Patterns

## C# Test Patterns

### xUnit Framework
- Use `[Fact]` for simple tests
- Use `[Theory]` with `[InlineData]` for parameterized tests
- Follow AAA pattern: Arrange, Act, Assert
- Use `Assert.Equal()`, `Assert.True()`, `Assert.Throws()` etc.

### Mocking with Moq
```csharp
var mockService = new Mock<IService>();
mockService.Setup(x => x.Method()).Returns(expectedValue);
```

### Test Structure
```csharp
[Fact]
public void MethodName_Condition_ExpectedResult()
{
    // Arrange
    var sut = new SystemUnderTest();
    
    // Act
    var result = sut.Method();
    
    // Assert
    Assert.Equal(expected, result);
}
```

## JavaScript/TypeScript Test Patterns

### Jest Framework
- Use `describe()` blocks for test suites
- Use `test()` or `it()` for individual tests
- Use `beforeEach()` and `afterEach()` for setup/teardown
- Mock modules with `jest.mock()`

### Async Testing
```javascript
test('async function', async () => {
    const result = await asyncFunction();
    expect(result).toBe(expected);
});
```

### Mocking
```javascript
const mockFunction = jest.fn();
mockFunction.mockReturnValue(expectedValue);
```

## General Guidelines

### Test Naming
- Use descriptive names that explain the scenario
- Format: `MethodName_StateUnderTest_ExpectedBehavior`
- Be specific about what is being tested

### Test Coverage
- Test happy path (normal flow)
- Test edge cases and boundary conditions
- Test error conditions and exception handling
- Test null/empty/invalid inputs

### Best Practices
- One assertion per test when possible
- Use meaningful test data, not just "test" or "foo"
- Clean up resources in teardown methods
- Keep tests independent and isolated
- Write tests that are easy to understand and maintain

### Error Testing
- Test that appropriate exceptions are thrown
- Verify error messages when relevant
- Test error handling paths

### Integration Testing
- Test API endpoints with real HTTP requests
- Test database interactions
- Test external service integrations with proper mocking