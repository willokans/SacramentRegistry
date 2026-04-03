package com.wyloks.churchRegistry.web;

import com.wyloks.churchRegistry.dto.CreateUserRequest;
import com.wyloks.churchRegistry.dto.IssueUserInvitationRequest;
import com.wyloks.churchRegistry.dto.IssueUserInvitationResponse;
import com.wyloks.churchRegistry.dto.ReplaceUserParishAccessRequest;
import com.wyloks.churchRegistry.dto.UserParishAccessResponse;
import com.wyloks.churchRegistry.service.AdminUserService;
import com.wyloks.churchRegistry.service.UserInvitationService;
import com.wyloks.churchRegistry.service.UserParishAccessService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/admin/users")
@RequiredArgsConstructor
public class UserAccessController {

    private final UserParishAccessService userParishAccessService;
    private final AdminUserService adminUserService;
    private final UserInvitationService userInvitationService;

    @PostMapping
    public ResponseEntity<UserParishAccessResponse> createUser(@Valid @RequestBody CreateUserRequest request) {
        UserParishAccessResponse created = adminUserService.createUser(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @PostMapping("/invitations")
    public ResponseEntity<IssueUserInvitationResponse> issueInvitation(
            @Valid @RequestBody IssueUserInvitationRequest request
    ) {
        IssueUserInvitationResponse created = userInvitationService.issueInvitation(request.getUserId());
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @PostMapping("/invitations/{invitationId}/resend")
    public ResponseEntity<IssueUserInvitationResponse> resendInvitation(@PathVariable Long invitationId) {
        IssueUserInvitationResponse created = userInvitationService.resendInvitation(invitationId);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @PostMapping("/invitations/{invitationId}/revoke")
    public ResponseEntity<Void> revokeInvitation(@PathVariable Long invitationId) {
        userInvitationService.revokeInvitation(invitationId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/parish-access")
    public List<UserParishAccessResponse> listUsersWithParishAccess() {
        return userParishAccessService.listAllUsersWithParishAccess();
    }

    @GetMapping("/{id}/parish-access")
    public ResponseEntity<UserParishAccessResponse> getUserParishAccess(@PathVariable("id") Long userId) {
        return ResponseEntity.ok(userParishAccessService.getUserParishAccess(userId));
    }

    @PutMapping("/{id}/parish-access")
    public ResponseEntity<UserParishAccessResponse> replaceUserParishAccess(
            @PathVariable("id") Long userId,
            @Valid @RequestBody ReplaceUserParishAccessRequest request
    ) {
        return ResponseEntity.ok(userParishAccessService.replaceUserParishAccess(userId, request));
    }
}
