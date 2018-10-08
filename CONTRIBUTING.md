# SmartSweeper Contribution Guidelines

Thank you for being interested in contributing to the development of SmartSweeper.

## Code of Conduct

We ask that all contributors follow our [code of conduct](CODE_OF_CONDUCT.md). Please report unacceptable behavior to [smartsweeper@swiftlet.technology](mailto:smartsweeper@swiftlet.technology).

## How Can I Contribute?
### Reporting Bugs

1. Please check [existing issues](/issues) to make sure the bug hasn't already been reported. If it has and the issue is still open, please add a new comment to the existing issue.
1. If the bug hasn't been reported, create a new issue by filling in the [bug report template](docs/bug_report.md). Please include as much information as you can.

### Suggesting Enhancements

1. Please check [existing issues](/issues) to make sure that no one else has suggested the same enhancement. If someone has and the issue is still open, please add a new comment to the existing issue.
1. If the suggestion hasn't already been made, please follow [these guidelines](docs/enhancement_suggestion.md).

## Style Guidelines

There are three styles currently in use:

* ```index.js```, ```smartcashapi.js```, and ```rpc-client.js``` more-or-less follow the [Electron style guidelines](https://electronjs.org/docs/development/coding-style)
* The other JavaScript files in general mostly follow the [W3Schools style guide](https://www.w3schools.com/js/js_conventions.asp).
* The file and folder structure in ```/app``` follows the [John Papa's Angular 1 style guide](https://github.com/johnpapa/angular-styleguide/blob/master/a1/README.md).

Going forward, all JavaScript will use the W3Schools style with an exception:
* Conditionals:
```javascript
if (time < 20) {
    greeting = "Good day";
}
else {
     greeting = "Good evening";
}
```

This guide was inspired by the [Atom contribution guidelines](https://github.com/atom/atom/blob/master/CONTRIBUTING.md).