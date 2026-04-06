package com.wyloks.churchRegistry.service;

public interface PasswordResetEmailService {

    /**
     * @param parishName optional; when non-blank, included in the body to reinforce legitimacy (primary parish on the account).
     */
    void sendPasswordResetEmail(String recipientEmail, String rawToken, String parishName);
}
