package com.wyloks.churchRegistry.service;

import com.wyloks.churchRegistry.entity.UserInvitation;

public interface InvitationEmailService {

    void sendInvitationEmail(UserInvitation invitation, String rawToken);
}
