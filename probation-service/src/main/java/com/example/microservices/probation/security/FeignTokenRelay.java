package com.example.microservices.probation.security;

import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import feign.RequestInterceptor;
import feign.RequestTemplate;

@Component
public class FeignTokenRelay implements RequestInterceptor {
    @Override public void apply(RequestTemplate template) {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getCredentials() instanceof String token && !token.isBlank())
            template.header("Authorization", "Bearer " + token);
    }
}
