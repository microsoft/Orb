/// <reference path="../node_modules/@types/mocha/index.d.ts" />
/// <reference path="../node_modules/@types/chai/index.d.ts" />

import { should, expect, assert } from "chai";

// Example test case for functional testing.
describe("Array", function () {
    describe("#indexOf()", function () {
        it("should return -1 when the value is not present", function () {
            assert.equal(-1, [1, 2, 3].indexOf(4));
        });
    });
});
