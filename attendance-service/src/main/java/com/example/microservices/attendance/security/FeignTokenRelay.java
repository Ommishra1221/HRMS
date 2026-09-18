package com.example.microservices.attendance.security;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

import feign.RequestInterceptor;
import feign.RequestTemplate;

/**
 * FeignTokenRelay = forwards the CALLER'S OWN JWT on every Feign call.
 *
 * WHY THIS EXISTS: attendance-service does not own employee data - every
 * response is composed live with a call to employee-service. But
 * employee-service is now protected too, so that internal call needs a token
 * as well.
 *
 * The rule is RELAY, not "service account": we attach the SAME token the
 * browser sent us. That keeps the ownership model intact end to end - when
 * an EMPLOYEE reads their own attendance, the internal employee lookup
 * happens AS that employee (who may read exactly one employee record: their
 * own). If we instead invented a "service account", employee-service would
 * silently trust every lookup, and one ownership bug here would leak other
 * people's data.
 *
 * HOW: the JwtAuthenticationFilter stores the raw token in the Authentication's
 * credentials; Spring Cloud OpenFeign applies this interceptor to EVERY
 * outgoing request made by any @FeignClient in this service.
 */
@Component
public class FeignTokenRelay implements RequestInterceptor {

    @Override
    public void apply(RequestTemplate template) {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        // The credentials slot holds the validated JWT (set by the filter).
        // Anonymous internal calls (none exist today) simply relay nothing.
        if (authentication != null && authentication.getCredentials() instanceof String token
                && !token.isBlank()) {
            template.header("Authorization", "Bearer " + token);
        }
    }
}
