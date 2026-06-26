# Developer/Tester documentation for SAS Extension

## Table Of Contents

- [Procedure for bugfixes and features](#procedure-for-bugfixes-and-features)

## Procedure for bugfixes and features

Here is the testing process proposal for this project (Code is merged in pull requests only, so testers only need to test "pull request"):

- Developers add label "doc needed" and document content in readme in pull request if it needs document changes.
- Developers add label "verification-needed" in the pull request which are ready for testing.
- Developers link issues which are to be fixed in the pull request.
- Developers change assignee to Sonny Williams (SW1SAS) in the pull request.
- Sonny Williams assigns it to the correct tester.
- Developers or testers add acceptance criteria tests in the pull request and start testing. Testers remove label "verification-needed" and add label "testing" in the pull request. Testers make sure readme is changed if label "doc needed" exists in this PR.
  - If the issues are fixed in topic branch code, testers approve the pull request. Testers remove label "testing" and add label "test complete", then change assignee to developer.
  - If the issues are not fixed in topic branch code, testers add comments in the pull request. Testers wait for developer's investigation and retest updated topic branch build. Once all the issues are fixed in new topic branch build, testers approve the pull request. Testers remove label "testing" and add label "test complete", then change assignee to developer.
- Developers merge code to main branch and change assignee to tester.
- Testers remove label "test complete" and verify the pull request in main branch. Testers verify readme content is changed and correct if label "doc needed" exists in this PR.
  - If the issues are fixed in main branch, testers add label "verified" in pull request. Developers close fixed issues linked in the pull request.
  - If the issues are not fixed in main branch, testers add comments in te pull request, reopen the pull request and assign it to developer.
- Managers will add appropriate version's milestone on the issue and pull request. Dev managers give signal when all code changes is finished in a release in Teams chat. Testing teams work on final validation with the main branch to make sure all issues and PRs in this release work well.
  - If no issue found in the final validation, testers remove label "verified" and add label "ready for release" in PRs. If all PRs are ready for release, testers confirm in Teams chat. Dev team delivers the release.
  - If issue is found in the final validtion, testers give feedback in Teams chat and go back to 8.b.

![Testing process diagram](img/test-process-diagram.png)
