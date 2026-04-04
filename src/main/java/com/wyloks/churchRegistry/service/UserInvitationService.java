package com.wyloks.churchRegistry.service;

import com.wyloks.churchRegistry.dto.IssueUserInvitationResponse;

public interface UserInvitationService {

    IssueUserInvitationResponse issueInvitation(Long userId);

    IssueUserInvitationResponse getLatestInvitationForUser(Long userId);

    IssueUserInvitationResponse resendInvitation(Long invitationId);

    void revokeInvitation(Long invitationId);

    void acceptInvitation(String token, String newPassword, String firstName, String lastName, String title,
                          String acceptedIpAddress, String acceptedUserAgent);
}
